import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { PaystackProvider } from "../providers/paystack.js";
import { ledger } from "../lib/ledger.js";

export const payoutRouter = Router();
const paystack = new PaystackProvider();

const recipientSchema = z.object({
  recipientCode: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  bankCode: z.string().optional(),
});

const payoutSchema = z.object({
  quoteId: z.string(),
  amountKobo: z.number().int().positive(),
  reason: z.string().optional(),
  recipient: recipientSchema,
});

/**
 * DEPRECATED: Direct payout endpoint.
 * This fires a Paystack transfer immediately WITHOUT verifying that crypto was deposited.
 * Use POST /v1/orders instead — it only pays out after a deposit is confirmed.
 *
 * This endpoint is kept for admin/internal use only and requires the owner API key.
 */
payoutRouter.post("/v1/payouts", async (req, res) => {
  // Safety: only the owner key can trigger direct payouts
  const apiKey = req.header("x-api-key") || "";
  if (apiKey !== process.env.OWNER_API_KEY) {
    return res.status(403).json({
      error: "direct_payout_restricted",
      hint: "Direct payouts are admin-only. Use POST /v1/orders for the safe offramp flow.",
    });
  }

  const parsed = payoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    let recipientCode = parsed.data.recipient.recipientCode;
    if (!recipientCode) {
      const { accountName, accountNumber, bankCode } = parsed.data.recipient;
      if (!accountName || !accountNumber || !bankCode) {
        return res.status(400).json({ error: "recipient_code_or_bank_details_required" });
      }
      const recipient = await paystack.createRecipient({
        name: accountName,
        accountNumber,
        bankCode,
        currency: "NGN",
      });
      recipientCode = recipient.recipientCode;
    }

    const transfer = await paystack.createTransfer({
      amountKobo: parsed.data.amountKobo,
      recipientCode,
      reason: parsed.data.reason,
    });

    const payoutId = `po_${randomUUID()}`;
    const record = {
      payoutId,
      quoteId: parsed.data.quoteId,
      amountKobo: parsed.data.amountKobo,
      currency: "NGN" as const,
      recipientCode,
      reason: parsed.data.reason,
      status: "processing" as const,
      provider: "paystack" as const,
      transferCode: transfer.transferCode,
      transferRef: transfer.transferRef,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await ledger.putPayout(record);

    console.warn(`[payout] ⚠️  DIRECT payout ${payoutId} triggered by admin (no deposit verification)`);
    return res.json(record);
  } catch (err: any) {
    const message = err?.message || "payout_failed";
    console.error("[payout] error:", message);
    return res.status(502).json({ error: "payout_provider_error", detail: message });
  }
});

payoutRouter.get("/v1/payouts/:payoutId", async (req, res) => {
  const payout = await ledger.getPayout(req.params.payoutId);
  if (!payout) return res.status(404).json({ error: "payout_not_found" });
  return res.json(payout);
});

payoutRouter.get("/v1/payouts", async (_req, res) => {
  return res.json({ payouts: await ledger.listPayouts() });
});
