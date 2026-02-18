import { Router } from "express";
import { PaystackProvider } from "../providers/paystack.js";
import { ledger } from "../lib/ledger.js";

export const webhookRouter = Router();
const paystack = new PaystackProvider();

webhookRouter.post("/v1/webhooks/paystack", async (req, res) => {
  const signature = String(req.headers["x-paystack-signature"] || "");
  const rawBody = String((req as any).rawBody || "");

  if (!paystack.verifyWebhook(rawBody, signature)) {
    return res.status(401).json({ error: "invalid_signature" });
  }

  const event = req.body;
  const kind = String(event?.event || "");
  if (!kind.startsWith("transfer.")) return res.json({ ok: true, ignored: true });

  const transferRef = String(event?.data?.reference || event?.data?.transfer_code || "");
  if (!transferRef) return res.json({ ok: true, ignored: true });

  const payout = await ledger.findPayoutByTransferRef(transferRef);
  if (!payout) return res.json({ ok: true, ignored: true });

  if (kind === "transfer.success") {
    await ledger.updatePayout(payout.payoutId, { status: "settled" });
    await ledger.updateOrder(payout.quoteId, { status: "settled" });
  } else if (kind === "transfer.failed" || kind === "transfer.reversed") {
    const reason = String(event?.data?.reason || kind);
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
