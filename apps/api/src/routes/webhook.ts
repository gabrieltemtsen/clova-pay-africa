import { Router } from "express";
import { PaycrestProvider } from "../providers/paycrest.js";
import { ledger } from "../lib/ledger.js";

export const webhookRouter = Router();
const paycrest = new PaycrestProvider();

// Keep paystack route alive but paused.
webhookRouter.post("/v1/webhooks/paystack", async (req, res) => {
  return res.json({ ok: true, ignored: true, note: "Paystack integration is paused." });
});

// New PayCrest webhook endpoint
webhookRouter.post("/v1/webhooks/paycrest", async (req, res) => {
  const signature = String(req.headers["x-paycrest-signature"] || req.headers["x-signature"] || "");
  const rawBody = String((req as any).rawBody || "");

  if (!paycrest.verifyWebhook(rawBody, signature)) {
    return res.status(401).json({ error: "invalid_signature" });
  }

  const payload = req.body;
  const eventName = String(payload?.event || "");

  if (!eventName.startsWith("order.")) return res.json({ ok: true, ignored: true });

  // According to PayCrest docs, webhook payload has:
  // { event: "order.fulfilled", orderId: "UUID", status: "fulfilled", data: { txHash: ... } }

  const orderId = String(payload?.orderId || payload?.data?.reference || payload?.reference || "");
  if (!orderId) return res.json({ ok: true, ignored: true });

  // Finding abstract payout or quote by ID
  const payout = await ledger.findPayoutByTransferRef(orderId);
  if (!payout) return res.json({ ok: true, ignored: true });

  if (eventName === "order.fulfilled" || payload?.status === "fulfilled") {
    await ledger.updatePayout(payout.payoutId, { status: "settled" });
    await ledger.updateOrder(payout.quoteId, { status: "settled", txHash: payload?.data?.txHash });
  } else if (eventName === "order.failed" || payload?.status === "failed") {
    const reason = String(payload?.data?.reason || payload?.reason || "paycrest_order_failed");
    await ledger.updatePayout(payout.payoutId, {
      status: "failed",
      failureReason: reason,
    });
    await ledger.updateOrder(payout.quoteId, {
      status: "failed",
      failureReason: reason,
    });
  }

  return res.json({ ok: true });
});
