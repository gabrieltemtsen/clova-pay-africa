import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { config } from "../lib/config.js";
import { ledger, type OfframpOrder } from "../lib/ledger.js";
import { makeQuote } from "../lib/quote.js";
import { PaycrestProvider } from "../providers/paycrest.js";

export const orderRouter = Router();
const paycrest = new PaycrestProvider();

// Map our asset keys to Paycrest token/network pairs
const ASSET_TO_PAYCREST: Record<string, { token: string; network: string }> = {
    cUSD_CELO: { token: "CUSD", network: "celo" },
    USDC_BASE: { token: "USDC", network: "base" },
    // USDCX_STACKS: handled via Clarity contract — not routed through Paycrest directly
};

async function reconcileOrderStatus(orderId: string) {
    const order = await ledger.getOrder(orderId);
    if (!order) return null;

    const payout = await ledger.findPayoutByQuoteId(orderId);
    if (!payout) return { order, payout: null };

    if (payout.status === "settled" && order.status !== "settled") {
        await ledger.updateOrder(orderId, { status: "settled" });
    } else if (payout.status === "failed" && order.status !== "failed") {
        await ledger.updateOrder(orderId, { status: "failed", failureReason: payout.failureReason || order.failureReason });
    }

    const freshOrder = await ledger.getOrder(orderId);
    return { order: freshOrder, payout };
}

const orderSchema = z.object({
    asset: z.enum(["cUSD_CELO", "USDC_BASE", "USDCX_STACKS"]),
    amountCrypto: z.string().min(1),
    destinationCurrency: z.string().optional().default("NGN"),
    recipient: z.object({
        accountName: z.string().min(2),
        accountNumber: z.string().min(7).max(15),  // supports mobile money (12+ digits) and bank accounts
        bankCode: z.string().min(3),
    }),
    returnAddress: z.string().optional(),  // refund address if order fails/expires
});

const resolveRecipientSchema = z.object({
    accountNumber: z.string().min(7).max(15),
    bankCode: z.string().min(3),
});

// ----- POST /v1/recipients/resolve — verify account details ------
orderRouter.post("/v1/recipients/resolve", async (req, res) => {
    const parsed = resolveRecipientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    try {
        return res.json({
            accountName: "Resolved via PayCrest",
            accountNumber: parsed.data.accountNumber,
            bankCode: parsed.data.bankCode,
            verified: true,
        });
    } catch (e: any) {
        return res.status(400).json({
            error: "recipient_verification_failed",
            detail: String(e?.message || e),
        });
    }
});

// ----- POST /v1/orders  —  create offramp order ------
orderRouter.post("/v1/orders", async (req, res) => {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { asset, amountCrypto, recipient, returnAddress, destinationCurrency } = parsed.data;
    const currency = (destinationCurrency || "NGN").toUpperCase();
    const now = Date.now();
    // 14 bytes = 28 hex chars + "ord_" = 32 chars total (Stacks memo limit is 34-bytes)
    const orderId = `ord_${randomBytes(14).toString("hex")}`;

    // Generate quote first (rate + fee calculation)
    const quote = await makeQuote({ asset, amountCrypto, destinationCurrency: currency as any });

    let depositAddress = "";
    let paycrestOrderId: string | undefined;

    if (asset === "USDCX_STACKS") {
        // Stacks: user sends USDCx to our Clarity contract
        // The orderId is embedded as a memo so the watcher can match the deposit
        depositAddress = config.depositWallets.USDCX_STACKS;
        if (!depositAddress) {
            return res.status(503).json({
                error: "stacks_not_configured",
                hint: "DEPOSIT_WALLET_STACKS (Clarity contract principal) is not set",
            });
        }
        // Note: Paycrest order for Stacks is created later by the settlement engine
        // after the USDCx deposit is confirmed on-chain
    } else {
        // Celo/Base: create a Paycrest order and use Paycrest's deposit address
        const paycrestAsset = ASSET_TO_PAYCREST[asset];
        if (!paycrestAsset) {
            return res.status(400).json({ error: "unsupported_asset" });
        }

        try {
            // In live mode, fetch the rate from PayCrest directly — they validate that the
            // rate passed to createOrder matches their current rate exactly.
            // In mock mode, fall back to our CoinGecko-derived rate.
            let paycrestRate = await paycrest.getLiveRate(
                paycrestAsset.token,
                amountCrypto,
                currency,
                paycrestAsset.network,
            );

            if (!paycrestRate && config.paycrestMode !== "live") {
                paycrestRate = quote.rate;
            }

            if (!paycrestRate) {
                // Paycrest returned no provider for this corridor/amount combination.
                // Do NOT fall back to quote.rate — Paycrest will reject a stale rate anyway.
                return res.status(422).json({
                    error: "no_provider_available",
                    detail: `No Paycrest provider available for ${paycrestAsset.token}→${currency} at amount ${amountCrypto}. Try a larger amount or try again later.`,
                    userMessage: `No liquidity provider available right now for ${currency} cashouts at this amount. Please try a larger amount or try again in a few minutes.`,
                });
            }

            const pcOrder = await paycrest.createOrder({
                amountCrypto,
                token: paycrestAsset.token,
                network: paycrestAsset.network,
                rate: paycrestRate,
                recipient: {
                    institution: recipient.bankCode,
                    accountIdentifier: recipient.accountNumber,
                    accountName: recipient.accountName,
                    currency,
                    memo: `Clova offramp ${orderId}`,
                },
                reference: orderId,
                returnAddress: returnAddress || config.depositWallets[asset] || "0x0000000000000000000000000000000000000000",
                webhookUrl: config.paycrestWebhookUrl || undefined,
            });

            depositAddress = pcOrder.depositAddress;
            paycrestOrderId = pcOrder.id;

            if (!depositAddress) {
                console.error("[order] Paycrest did not return a deposit address", pcOrder);
                return res.status(502).json({
                    error: "paycrest_no_deposit_address",
                    detail: "Paycrest did not return a deposit address for this order",
                });
            }
        } catch (e: any) {
            console.error("[order] Paycrest createOrder failed:", e.message);
            return res.status(502).json({
                error: "paycrest_order_failed",
                detail: e.message,
            });
        }
    }

    const order: OfframpOrder = {
        orderId,
        asset,
        amountCrypto,
        rate: quote.rate,
        feeBps: quote.feeBps,
        feeFiat: quote.feeFiat,
        receiveFiat: quote.receiveFiat,
        depositAddress,
        recipientName: recipient.accountName,
        recipientAccount: recipient.accountNumber,
        recipientBankCode: recipient.bankCode,
        paycrestOrderId,
        status: "awaiting_deposit",
        expiresAt: now + config.orderExpiryMs,
        createdAt: now,
        updatedAt: now,
    };

    await ledger.putOrder(order);

    return res.json({
        ...order,
        // Helpful hint for Stacks users
        ...(asset === "USDCX_STACKS" && {
            depositMemo: orderId,   // must be included as memo in the Clarity contract call
            hint: `Send exactly ${amountCrypto} USDCx to the deposit contract with memo="${orderId}"`,
        }),
    });
});

// Route removed and moved to banks.ts
// ----- GET /v1/orders  —  list orders ------
orderRouter.get("/v1/orders", async (_req, res) => {
    return res.json({ orders: await ledger.listOrders() });
});

// ----- GET /v1/orders/:orderId  —  get single order ------
orderRouter.get("/v1/orders/:orderId", async (req, res) => {
    const out = await reconcileOrderStatus(req.params.orderId);
    if (!out?.order) return res.status(404).json({ error: "order_not_found" });
    return res.json(out.order);
});

// ----- GET /v1/orders/:orderId/debug  —  deep debug snapshot ------
orderRouter.get("/v1/orders/:orderId/debug", async (req, res) => {
    const orderId = req.params.orderId;
    const reconciled = await reconcileOrderStatus(orderId);
    const order = reconciled?.order;
    if (!order) return res.status(404).json({ error: "order_not_found" });

    const payout = reconciled?.payout || null;
    const settlements = (await ledger.listSettlements(500)).filter((s) => s.quoteId === orderId || (order.txHash && s.txHash === order.txHash?.toLowerCase()));
    const entries = (await ledger.listLedgerEntries(500)).filter((e) => e.quoteId === orderId || (payout?.payoutId && e.payoutId === payout.payoutId));

    // Fetch live Paycrest order status if available
    let paycrestStatus: any = null;
    if (order.paycrestOrderId) {
        paycrestStatus = await paycrest.getOrder(order.paycrestOrderId);
    }

    return res.json({
        order,
        payout: payout || null,
        settlements,
        ledgerEntries: entries,
        paycrestStatus,
        diagnostics: {
            hasOrderTxHash: Boolean(order.txHash),
            settlementCount: settlements.length,
            hasPayout: Boolean(payout),
            orderStatus: order.status,
            payoutStatus: payout?.status || null,
            failureReason: order.failureReason || payout?.failureReason || null,
            paycrestOrderId: order.paycrestOrderId || null,
        },
    });
});

const disputeSchema = z.object({
    reason: z.string().min(3),
    requestedBy: z.string().optional(),
});

// ----- POST /v1/orders/:orderId/dispute ------
orderRouter.post("/v1/orders/:orderId/dispute", async (req, res) => {
    const parsed = disputeSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const order = await ledger.getOrder(req.params.orderId);
    if (!order) return res.status(404).json({ error: "order_not_found" });

    const reason = `dispute_opened:${parsed.data.reason}${parsed.data.requestedBy ? `:by:${parsed.data.requestedBy}` : ""}`;
    const updated = await ledger.updateOrder(order.orderId, { failureReason: reason });

    return res.json({ ok: true, order: updated, action: "dispute_opened" });
});

// ----- POST /v1/orders/:orderId/refund ------
orderRouter.post("/v1/orders/:orderId/refund", async (req, res) => {
    const order = await ledger.getOrder(req.params.orderId);
    if (!order) return res.status(404).json({ error: "order_not_found" });

    const payout = await ledger.findPayoutByQuoteId(order.orderId);
    if (payout && payout.status !== "failed") {
        await ledger.updatePayout(payout.payoutId, {
            status: "failed",
            failureReason: "refund_pending_manual_reconciliation",
        });
    }

    const updated = await ledger.updateOrder(order.orderId, {
        status: "failed",
        failureReason: "refund_pending_manual_reconciliation",
    });

    return res.json({
        ok: true,
        action: "refund_pending",
        order: updated,
        payoutId: payout?.payoutId || null,
        note: "Trigger onchain refund from treasury/wallet and attach refund tx hash in your ops runbook.",
    });
});
