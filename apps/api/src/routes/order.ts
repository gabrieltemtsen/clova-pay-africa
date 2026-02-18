import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { config } from "../lib/config.js";
import { ledger, type OfframpOrder } from "../lib/ledger.js";
import { makeQuote } from "../lib/quote.js";
import { PaystackProvider } from "../providers/paystack.js";

export const orderRouter = Router();
const paystack = new PaystackProvider();

async function reconcileOrderStatus(orderId: string) {
    const order = await ledger.getOrder(orderId);
    if (!order) return null;

    const payout = await ledger.findPayoutByQuoteId(orderId);
    if (!payout) return { order, payout: null };

    // Keep order status consistent with payout terminal states.
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
    recipient: z.object({
        accountName: z.string().min(2),
        accountNumber: z.string().min(10).max(10),
        bankCode: z.string().min(3),
    }),
});

const resolveRecipientSchema = z.object({
    accountNumber: z.string().min(10).max(10),
    bankCode: z.string().min(3),
});

// ----- POST /v1/recipients/resolve — verify account details ------
orderRouter.post("/v1/recipients/resolve", async (req, res) => {
    const parsed = resolveRecipientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    try {
        const resolved = await paystack.resolveAccount(parsed.data.accountNumber, parsed.data.bankCode);
        return res.json({
            accountName: resolved.accountName,
            accountNumber: resolved.accountNumber,
            bankCode: resolved.bankCode,
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

    const { asset, amountCrypto, recipient } = parsed.data;

    const depositAddress = config.depositWallets[asset];
    if (!depositAddress) {
        return res.status(503).json({ error: "no_deposit_wallet", hint: `No deposit wallet configured for ${asset}` });
    }

    let resolvedAccountName = recipient.accountName;
    try {
        const resolved = await paystack.resolveAccount(recipient.accountNumber, recipient.bankCode);
        resolvedAccountName = resolved.accountName || recipient.accountName;
    } catch (e: any) {
        return res.status(400).json({ error: "recipient_verification_failed", detail: String(e?.message || e) });
    }

    const quote = await makeQuote({ asset, amountCrypto, destinationCurrency: "NGN" });
    const now = Date.now();

    const order: OfframpOrder = {
        orderId: `ord_${randomUUID()}`,
        asset,
        amountCrypto,
        rate: quote.rate,
        feeBps: quote.feeBps,
        feeNgn: quote.feeNgn,
        receiveNgn: quote.receiveNgn,
        depositAddress,
        recipientName: resolvedAccountName,
        recipientAccount: recipient.accountNumber,
        recipientBankCode: recipient.bankCode,
        status: "awaiting_deposit",
        expiresAt: now + config.orderExpiryMs,
        createdAt: now,
        updatedAt: now,
    };

    await ledger.putOrder(order);

    return res.json(order);
});

// ----- GET /v1/banks — discover payout banks ------
orderRouter.get("/v1/banks", async (req, res) => {
    const country = String(req.query.country || "nigeria");
    const banks = await paystack.listBanks(country);
    return res.json({ country, banks });
});

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

// ----- GET /v1/orders/:orderId/debug  —  deep debug snapshot for reconciliation ------
orderRouter.get("/v1/orders/:orderId/debug", async (req, res) => {
    const orderId = req.params.orderId;
    const reconciled = await reconcileOrderStatus(orderId);
    const order = reconciled?.order;
    if (!order) return res.status(404).json({ error: "order_not_found" });

    const payout = reconciled?.payout || null;
    const settlements = (await ledger.listSettlements(500)).filter((s) => s.quoteId === orderId || (order.txHash && s.txHash === order.txHash.toLowerCase()));
    const entries = (await ledger.listLedgerEntries(500)).filter((e) => e.quoteId === orderId || (payout?.payoutId && e.payoutId === payout.payoutId));

    return res.json({
        order,
        payout: payout || null,
        settlements,
        ledgerEntries: entries,
        diagnostics: {
            hasOrderTxHash: Boolean(order.txHash),
            settlementCount: settlements.length,
            hasPayout: Boolean(payout),
            orderStatus: order.status,
            payoutStatus: payout?.status || null,
            failureReason: order.failureReason || payout?.failureReason || null,
        },
    });
});

const disputeSchema = z.object({
    reason: z.string().min(3),
    requestedBy: z.string().optional(),
});

// ----- POST /v1/orders/:orderId/dispute  —  open a reconciliation/dispute record on order ------
orderRouter.post("/v1/orders/:orderId/dispute", async (req, res) => {
    const parsed = disputeSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const order = await ledger.getOrder(req.params.orderId);
    if (!order) return res.status(404).json({ error: "order_not_found" });

    const reason = `dispute_opened:${parsed.data.reason}${parsed.data.requestedBy ? `:by:${parsed.data.requestedBy}` : ""}`;
    const updated = await ledger.updateOrder(order.orderId, { failureReason: reason });

    return res.json({ ok: true, order: updated, action: "dispute_opened" });
});

// ----- POST /v1/orders/:orderId/refund  —  mark payout failure path and refund pending ------
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
