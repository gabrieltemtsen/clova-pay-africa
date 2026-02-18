import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { ledger } from "./ledger.js";
import { PaystackProvider } from "../providers/paystack.js";
import { verifyDeposit } from "./chainVerifier.js";

const paystack = new PaystackProvider();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type CreditedInput = {
  quoteId?: string;
  orderId?: string;
  asset: "cUSD_CELO" | "USDC_BASE" | "USDCX_STACKS";
  amountCrypto: string;
  txHash: string;
  confirmations: number;
  source: "watcher" | "manual";
  providerId?: string;
};

export async function processCredited(input: CreditedInput) {
  const now = Date.now();

  // Determine the quoteId — if an orderId is given, pull it from the order
  let quoteId = input.quoteId || "";
  let order = input.orderId ? await ledger.getOrder(input.orderId) : undefined;

  // If quoteId looks like an orderId, try to resolve it
  if (!order && quoteId.startsWith("ord_")) {
    order = await ledger.getOrder(quoteId);
  }

  // Use the orderId as quoteId for settlement tracking when order-based
  if (order) quoteId = order.orderId;
  if (!quoteId) return { error: "quoteId_or_orderId_required" };

  // ── ON-CHAIN VERIFICATION ──────────────────────────────────
  // Verify the txHash is real before doing anything
  if (order) {
    const depositWallet = config.depositWallets[order.asset];
    if (depositWallet) {
      // For watcher-driven events, wait before first chain check to avoid tx propagation race.
      if (input.source === "watcher" && config.settlementPrecheckDelayMs > 0) {
        console.log(`[settlement] waiting ${config.settlementPrecheckDelayMs}ms before verification for ${input.txHash.substring(0, 16)}...`);
        await sleep(config.settlementPrecheckDelayMs);
      }

      let verification: any = null;
      const maxAttempts = Math.max(1, config.settlementVerifyMaxAttempts || 1);
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        console.log(`[settlement] verifying tx ${input.txHash.substring(0, 16)}... on-chain (attempt ${attempt}/${maxAttempts})`);

        verification = await verifyDeposit({
          txHash: input.txHash,
          asset: order.asset,
          expectedAmount: order.amountCrypto,
          expectedRecipient: depositWallet,
          minConfirmations: config.minConfirmations[order.asset] || 1,
        });

        if (verification.verified) break;

        const isRetryable = String(verification.error || "").includes("tx_not_found_or_pending");
        if (!isRetryable || attempt >= maxAttempts) break;

        console.warn(`[settlement] retryable verification failure (${verification.error}); retrying in ${config.settlementVerifyRetryDelayMs}ms`);
        await sleep(config.settlementVerifyRetryDelayMs);
      }

      if (!verification?.verified) {
        console.error(`[settlement] ❌ REJECTED tx ${input.txHash.substring(0, 16)}...: ${verification?.error}`);
        return {
          error: "deposit_verification_failed",
          detail: verification?.error || "verification_failed",
          verification,
        };
      }

      console.log(`[settlement] ✅ tx verified: ${verification.amountOnChain} ${order.asset} from ${verification.from}`);
    }
  }

  const created = await ledger.createSettlementIfAbsent({
    settlementId: `st_${randomUUID()}`,
    quoteId,
    asset: input.asset,
    amountCrypto: input.amountCrypto,
    txHash: input.txHash,
    confirmations: input.confirmations,
    source: input.source,
    status: "credited",
    createdAt: now,
    updatedAt: now,
  });

  if (!created.inserted) {
    return { ...created, idempotent: true };
  }

  // ── ORDER-BASED AUTO-PAYOUT ──────────────────────────────────
  if (order && order.status === "awaiting_deposit") {
    try {
      await ledger.updateOrder(order.orderId, { status: "confirming", txHash: input.txHash });

      // Create Paystack recipient
      const recipient = await paystack.createRecipient({
        name: order.recipientName,
        accountNumber: order.recipientAccount,
        bankCode: order.recipientBankCode,
        currency: "NGN",
      });

      const amountKobo = Math.round(Number(order.receiveNgn) * 100);
      const transfer = await paystack.createTransfer({
        amountKobo,
        recipientCode: recipient.recipientCode,
        reason: `Clova offramp ${order.orderId}`,
      });

      const payoutId = `po_${randomUUID()}`;
      await ledger.putPayout({
        payoutId,
        quoteId: order.orderId,
        amountKobo,
        currency: "NGN",
        recipientCode: recipient.recipientCode,
        reason: `Clova offramp ${order.orderId}`,
        status: "processing",
        provider: "paystack",
        transferCode: transfer.transferCode,
        transferRef: transfer.transferRef,
        createdAt: now,
        updatedAt: now,
      });

      await ledger.updateOrder(order.orderId, {
        status: "paid_out",
        recipientCode: recipient.recipientCode,
        payoutId,
        transferCode: transfer.transferCode,
      });

      // Record platform fee
      const totalFeeKobo = Math.max(0, Math.round((amountKobo * config.defaultFeeBps) / 10000));
      if (totalFeeKobo > 0) {
        await ledger.addLedgerEntry({
          entryId: `le_${randomUUID()}`,
          quoteId: order.orderId,
          payoutId,
          kind: "platform_fee",
          currency: "NGN",
          amountKobo: totalFeeKobo,
          memo: `Auto-payout fee for order ${order.orderId}`,
          createdAt: now,
        });
      }

      console.log(`[settlement] order ${order.orderId} → auto-payout ${payoutId} (${transfer.transferCode})`);

      return {
        ...created,
        idempotent: false,
        orderId: order.orderId,
        payoutId,
        transferCode: transfer.transferCode,
        status: "paid_out",
        fees: { totalFeeKobo, platformFeeKobo: totalFeeKobo, lpFeeKobo: 0, providerId: null },
      };

    } catch (err: any) {
      const reason = err?.message || "auto_payout_failed";
      console.error(`[settlement] auto-payout failed for order ${order.orderId}:`, reason);
      await ledger.updateOrder(order.orderId, { status: "failed", failureReason: reason });

      return {
        ...created,
        idempotent: false,
        orderId: order.orderId,
        status: "failed",
        error: reason,
      };
    }
  }

  // ── LEGACY PAYOUT-BASED FLOW ─────────────────────────────────
  const payout = await ledger.findPayoutByQuoteId(quoteId);
  if (!payout) {
    return { ...created, idempotent: false, warning: "payout_not_found_for_quote" };
  }

  const totalFeeKobo = Math.max(0, Math.round((payout.amountKobo * config.defaultFeeBps) / 10000));
  let lpFeeKobo = 0;
  let providerId = input.providerId;

  if (providerId) {
    const lp = await ledger.getProvider(providerId);
    if (lp) lpFeeKobo = Math.min(totalFeeKobo, Math.round((payout.amountKobo * lp.feeBps) / 10000));
    else providerId = undefined;
  }

  const platformFeeKobo = Math.max(0, totalFeeKobo - lpFeeKobo);

  if (platformFeeKobo > 0) {
    await ledger.addLedgerEntry({
      entryId: `le_${randomUUID()}`,
      quoteId: payout.quoteId,
      payoutId: payout.payoutId,
      kind: "platform_fee",
      currency: "NGN",
      amountKobo: platformFeeKobo,
      memo: `Fee accrual on settlement tx ${created.settlement.txHash}`,
      createdAt: now,
    });
  }

  if (lpFeeKobo > 0 && providerId) {
    await ledger.addLedgerEntry({
      entryId: `le_${randomUUID()}`,
      quoteId: payout.quoteId,
      payoutId: payout.payoutId,
      providerId,
      kind: "lp_fee",
      currency: "NGN",
      amountKobo: lpFeeKobo,
      memo: `LP fee accrual on settlement tx ${created.settlement.txHash}`,
      createdAt: now,
    });
  }

  return {
    ...created,
    idempotent: false,
    payoutId: payout.payoutId,
    fees: {
      totalFeeKobo,
      platformFeeKobo,
      lpFeeKobo,
      providerId: providerId || null,
    },
  };
}
