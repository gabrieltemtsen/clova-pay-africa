import { Router } from "express";
import { PaycrestProvider } from "../providers/paycrest.js";
import { ledger } from "../lib/ledger.js";

export const webhookRouter = Router();
const paycrest = new PaycrestProvider();

// Keep paystack route alive but paused.
webhookRouter.post("/v1/webhooks/paystack", async (req, res) => {
  return res.json({ ok: true, ignored: true, note: "Paystack integration is paused." });
});

// PayCrest v2 & v1 webhook: https://docs.paycrest.io/implementation-guides/sender-api-integration#webhook-implementation
// Header: X-Paycrest-Signature (HMAC-SHA256 of rawBody using PAYCREST_WEBHOOK_SECRET or PAYCREST_API_KEY)
// v2 Payload: { event: "payment_order.settled" | "payment_order.refunded" | ..., webhookVersion: "2", data: { id, reference, status, ... } }
webhookRouter.post("/v1/webhooks/paycrest", async (req, res) => {
  const signature = String(req.headers["x-paycrest-signature"] || "");
  const rawBody = String((req as any).rawBody || "");

  if (!paycrest.verifyWebhook(rawBody, signature)) {
    return res.status(401).json({ error: "invalid_signature" });
  }

  const payload = req.body;
  const eventName = String(payload?.event || "");

  if (!eventName.startsWith("payment_order.") && !eventName.startsWith("order.")) {
    return res.json({ ok: true, ignored: true });
  }

  // PayCrest sends order reference (which we set to our orderId) in data.reference
  const reference = String(payload?.data?.reference || payload?.reference || payload?.orderId || "");
  if (!reference) return res.json({ ok: true, ignored: true });

  // Look up our internal order by orderId (we set reference = orderId when creating)
  const order = await ledger.getOrder(reference);
  if (!order) {
    console.warn("[webhook/paycrest] no order found for reference:", reference);
    return res.json({ ok: true, ignored: true });
  }

  if (
    eventName === "payment_order.settled" ||
    eventName === "order.fulfilled" ||
    eventName === "order.settled"
  ) {
    await ledger.updateOrder(order.orderId, {
      status: "settled",
      txHash: payload?.data?.txHash || order.txHash,
    });
    if (order.payoutId) {
      await ledger.updatePayout(order.payoutId, { status: "settled" });
    }
  } else if (
    eventName === "payment_order.refunded" ||
    eventName === "payment_order.expired" ||
    eventName === "order.failed" ||
    eventName === "order.refunded" ||
    eventName === "order.expired"
  ) {
    const reason = String(payload?.data?.reason || payload?.data?.message || eventName);
    await ledger.updateOrder(order.orderId, { status: "failed", failureReason: reason });
    if (order.payoutId) {
      await ledger.updatePayout(order.payoutId, { status: "failed", failureReason: reason });
    }
  } else if (
    eventName === "payment_order.pending" ||
    eventName === "payment_order.validated" ||
    eventName === "payment_order.settling"
  ) {
    await ledger.updateOrder(order.orderId, { status: "confirming" });
  }

  return res.json({ ok: true });
});
