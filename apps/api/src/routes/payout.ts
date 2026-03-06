import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { PaycrestProvider } from "../providers/paycrest.js";
import { ledger } from "../lib/ledger.js";

export const payoutRouter = Router();
const paycrest = new PaycrestProvider();

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
    const { accountName, accountNumber, bankCode } = parsed.data.recipient;
    if (!accountName || !accountNumber || !bankCode) {
      return res.status(400).json({ error: "recipient_bank_details_required" });
    }

    // Direct payout uses the current exchange rate and simulates the standard order
    const rate = await paycrest.getExchangeRate("USDC", "1", "NGN");
    const amountCryptoString = (parsed.data.amountKobo / 100 / parseFloat(rate)).toFixed(6);

    const orderReq = {
      amountCrypto: amountCryptoString,
      token: "USDC", // defaulting to USDC for direct payouts
      network: "base",
      rate,
      recipient: {
        institution: bankCode,
        accountIdentifier: accountNumber,
        accountName,
        currency: "NGN",
        memo: parsed.data.reason || "Direct payout",
      },
      reference: `po_${randomUUID()}`,
      returnAddress: "0x0000000000000000000000000000000000000000",
    };

    const pcOrder = await paycrest.createOrder(orderReq);

    const record = {
      payoutId: orderReq.reference,
      quoteId: parsed.data.quoteId,
      amountKobo: parsed.data.amountKobo,
      currency: "NGN" as const,
      recipientCode: orderReq.reference,
      reason: parsed.data.reason,
      status: "processing" as const,
      provider: "paycrest" as const,
      transferCode: pcOrder.id || pcOrder.reference || orderReq.reference,
      transferRef: orderReq.reference,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await ledger.putPayout(record);

    console.warn(`[payout] ⚠️  DIRECT payout ${record.payoutId} triggered by admin (no deposit verification)`);
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
