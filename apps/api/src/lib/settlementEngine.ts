/**
 * settlementEngine.ts
 *
 * Handles confirmed on-chain deposits and triggers fiat payouts.
 *
 * Payout rail: Paycrest (primary).
 * Paystack: SUSPENDED — webhook stub kept but no new payouts are created.
 *
 * Flow per asset:
 *  - cUSD_CELO / USDC_BASE:
 *      Paycrest order was already created at POST /v1/orders.
 *      Settlement engine records the deposit + updates order to "confirming".
 *      Paycrest webhook (POST /v1/webhooks/paycrest) handles final status.
 *
 *  - USDCX_STACKS:
 *      No Paycrest order yet (Paycrest doesn't support Stacks natively).
 *      Settlement engine creates a fresh Paycrest USDC/Base order funded from
 *      our reserve wallet, then updates order status.
 *      The USDCx in the Clarity contract is swept separately by ops.
 */

import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { ledger } from "./ledger.js";
import { PaycrestProvider } from "../providers/paycrest.js";
import { verifyDeposit } from "./chainVerifier.js";

const paycrest = new PaycrestProvider();

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

    // Resolve orderId / quoteId
    let quoteId = input.quoteId || "";
    let order = input.orderId ? await ledger.getOrder(input.orderId) : undefined;

    if (!order && quoteId.startsWith("ord_")) {
        order = await ledger.getOrder(quoteId);
    }
    if (order) quoteId = order.orderId;
    if (!quoteId) return { error: "quoteId_or_orderId_required" };

    // ── ON-CHAIN VERIFICATION ─────────────────────────────────────────────
    if (order) {
        const depositWallet = config.depositWallets[order.asset];
        // For Celo/Base, depositWallet is Paycrest's address — skip our own verification
        // (Paycrest handles it). For Stacks, depositWallet is our Clarity contract.
        const shouldVerify = order.asset === "USDCX_STACKS" && Boolean(depositWallet);

        if (shouldVerify && depositWallet) {
            if (input.source === "watcher" && config.settlementPrecheckDelayMs > 0) {
                console.log(`[settlement] waiting ${config.settlementPrecheckDelayMs}ms before Stacks verification`);
                await sleep(config.settlementPrecheckDelayMs);
            }

            let verification: any = null;
            const maxAttempts = Math.max(1, config.settlementVerifyMaxAttempts || 1);
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                console.log(`[settlement] verifying Stacks tx ${input.txHash.slice(0, 16)}... (attempt ${attempt}/${maxAttempts})`);
                verification = await verifyDeposit({
                    txHash: input.txHash,
                    asset: order.asset,
                    expectedAmount: order.amountCrypto,
                    expectedRecipient: depositWallet,
                    minConfirmations: config.minConfirmations[order.asset] || 1,
                });

                if (verification.verified) break;

                const retryable = String(verification.error || "").includes("tx_not_found_or_pending");
                if (!retryable || attempt >= maxAttempts) break;

                await sleep(config.settlementVerifyRetryDelayMs);
            }

            if (!verification?.verified) {
                console.error(`[settlement] ❌ REJECTED Stacks tx ${input.txHash.slice(0, 16)}: ${verification?.error}`);
                return { error: "deposit_verification_failed", detail: verification?.error, verification };
            }
            console.log(`[settlement] ✅ Stacks tx verified: ${verification.amountOnChain} USDCx`);
        }
    }

    // ── IDEMPOTENT SETTLEMENT RECORD ────────────────────────────────────
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

    if (!order || order.status !== "awaiting_deposit") {
        return { ...created, idempotent: false, warning: "order_not_found_or_wrong_status" };
    }

    // Mark as confirming
    await ledger.updateOrder(order.orderId, { status: "confirming", txHash: input.txHash });

    // ── PAYOUT ROUTING ────────────────────────────────────────────────────

    // cUSD_CELO / USDC_BASE — Paycrest order was already created at order time.
    // Just update the ledger; Paycrest webhook will flip status to settled/failed.
    if (order.asset === "cUSD_CELO" || order.asset === "USDC_BASE") {
        if (!order.paycrestOrderId) {
            // Edge case: order was created before Paycrest integration.
            // Fall through to legacy flow below.
            console.warn(`[settlement] order ${order.orderId} has no paycrestOrderId — falling back to ad-hoc Paycrest order`);
        } else {
            console.log(`[settlement] ✅ deposit confirmed for Paycrest order ${order.paycrestOrderId} — awaiting Paycrest webhook`);
            return {
                ...created,
                idempotent: false,
                orderId: order.orderId,
                paycrestOrderId: order.paycrestOrderId,
                status: "confirming",
                note: "Paycrest is handling payout — final status via webhook",
            };
        }
    }

    // USDCX_STACKS — create a fresh Paycrest order using USDC/Base reserves.
    if (order.asset === "USDCX_STACKS") {
        try {
            const reserveWallet = config.stacksReserveWallet;
            if (!reserveWallet) {
                throw new Error("STACKS_RESERVE_WALLET not configured — cannot create Paycrest order for Stacks payout");
            }

            const pcOrder = await paycrest.createOrder({
                amountCrypto: order.amountCrypto,
                token: "USDC",
                network: "base",
                rate: order.rate,
                recipient: {
                    institution: order.recipientBankCode,
                    accountIdentifier: order.recipientAccount,
                    accountName: order.recipientName,
                    currency: "NGN",
                    memo: `Clova Stacks offramp ${order.orderId}`,
                },
                reference: order.orderId,
                returnAddress: reserveWallet,
            });

            const payoutId = `po_${randomUUID()}`;
            await ledger.putPayout({
                payoutId,
                quoteId: order.orderId,
                amountKobo: Math.round(Number(order.receiveNgn) * 100),
                currency: "NGN",
                recipientCode: order.orderId,
                reason: `Stacks USDCx offramp ${order.orderId}`,
                status: "processing",
                provider: "paycrest",
                transferCode: pcOrder.id,
                transferRef: order.orderId,
                createdAt: now,
                updatedAt: now,
            });

            await ledger.updateOrder(order.orderId, {
                paycrestOrderId: pcOrder.id,
                payoutId,
                transferCode: pcOrder.id,
            });

            console.log(`[settlement] Stacks order ${order.orderId} → Paycrest order ${pcOrder.id}`);
            return {
                ...created,
                idempotent: false,
                orderId: order.orderId,
                paycrestOrderId: pcOrder.id,
                status: "confirming",
                note: "Paycrest USDC/Base order created — fiat payout in progress",
            };
        } catch (err: any) {
            const reason = err?.message || "stacks_paycrest_order_failed";
            console.error(`[settlement] Stacks payout failed for ${order.orderId}:`, reason);
            await ledger.updateOrder(order.orderId, { status: "failed", failureReason: reason });
            return { ...created, idempotent: false, orderId: order.orderId, status: "failed", error: reason };
        }
    }

    // ── LEGACY FALLBACK: no paycrestOrderId on Celo/Base order ─────────
    // Create an ad-hoc Paycrest order (covers orders created before this migration)
    try {
        const paycrestAssetMap: Record<string, { token: string; network: string }> = {
            cUSD_CELO: { token: "CUSD", network: "celo" },
            USDC_BASE: { token: "USDC", network: "base" },
        };
        const pa = paycrestAssetMap[order.asset];
        if (!pa) throw new Error(`no_paycrest_mapping_for_${order.asset}`);

        const pcOrder = await paycrest.createOrder({
            amountCrypto: order.amountCrypto,
            token: pa.token,
            network: pa.network,
            rate: order.rate,
            recipient: {
                institution: order.recipientBankCode,
                accountIdentifier: order.recipientAccount,
                accountName: order.recipientName,
                currency: "NGN",
                memo: `Clova legacy offramp ${order.orderId}`,
            },
            reference: order.orderId,
            returnAddress: config.depositWallets[order.asset] || "0x0000000000000000000000000000000000000000",
        });

        const payoutId = `po_${randomUUID()}`;
        await ledger.putPayout({
            payoutId,
            quoteId: order.orderId,
            amountKobo: Math.round(Number(order.receiveNgn) * 100),
            currency: "NGN",
            recipientCode: order.orderId,
            reason: `Legacy offramp ${order.orderId}`,
            status: "processing",
            provider: "paycrest",
            transferCode: pcOrder.id,
            transferRef: order.orderId,
            createdAt: now,
            updatedAt: now,
        });

        await ledger.updateOrder(order.orderId, {
            paycrestOrderId: pcOrder.id,
            payoutId,
            transferCode: pcOrder.id,
        });

        console.log(`[settlement] legacy order ${order.orderId} → Paycrest ${pcOrder.id}`);
        return {
            ...created,
            idempotent: false,
            orderId: order.orderId,
            paycrestOrderId: pcOrder.id,
            status: "confirming",
        };
    } catch (err: any) {
        const reason = err?.message || "paycrest_ad_hoc_order_failed";
        console.error(`[settlement] legacy payout failed for ${order.orderId}:`, reason);
        await ledger.updateOrder(order.orderId, { status: "failed", failureReason: reason });
        return { ...created, idempotent: false, orderId: order.orderId, status: "failed", error: reason };
    }
}
