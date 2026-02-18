import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { config } from "../lib/config.js";
import { ledger, type OfframpOrder } from "../lib/ledger.js";
import { makeQuote } from "../lib/quote.js";
import { PaystackProvider } from "../providers/paystack.js";

export const orderRouter = Router();
const paystack = new PaystackProvider();

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
    const order = await ledger.getOrder(req.params.orderId);
    if (!order) return res.status(404).json({ error: "order_not_found" });
    return res.json(order);
});
