import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { ledger } from "./ledger.js";

export type CreditedInput = {
  quoteId: string;
  asset: "cUSD_CELO" | "USDC_BASE" | "USDCX_STACKS";
  amountCrypto: string;
  txHash: string;
  confirmations: number;
  source: "watcher" | "manual";
  providerId?: string;
};

export async function processCredited(input: CreditedInput) {
  const now = Date.now();
  const created = await ledger.createSettlementIfAbsent({
    settlementId: `st_${randomUUID()}`,
    quoteId: input.quoteId,
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

  const payout = await ledger.findPayoutByQuoteId(input.quoteId);
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
