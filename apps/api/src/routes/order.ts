import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { config } from "../lib/config.js";
import { ledger, type OfframpOrder } from "../lib/ledger.js";
import { makeQuote } from "../lib/quote.js";

export const orderRouter = Router();

const orderSchema = z.object({
    asset: z.enum(["cUSD_CELO", "USDC_BASE", "USDCX_STACKS"]),
    amountCrypto: z.string().min(1),
    recipient: z.object({
        accountName: z.string().min(2),
        accountNumber: z.string().min(10).max(10),
        bankCode: z.string().min(3),
    }),
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
        recipientName: recipient.accountName,
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
