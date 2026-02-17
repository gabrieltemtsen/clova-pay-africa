import { Router } from "express";
import { z } from "zod";
import { PaystackProvider } from "../providers/paystack.js";

export const payoutRouter = Router();
const paystack = new PaystackProvider();

const payoutSchema = z.object({
  quoteId: z.string(),
  recipientCode: z.string(),
  amountKobo: z.number().int().positive(),
  reason: z.string().optional(),
});

payoutRouter.post("/v1/payouts", async (req, res) => {
  const parsed = payoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const transfer = await paystack.createTransfer({
    amountKobo: parsed.data.amountKobo,
    recipientCode: parsed.data.recipientCode,
    reason: parsed.data.reason,
  });

  return res.json({
    payoutId: `po_${Date.now()}`,
    quoteId: parsed.data.quoteId,
    status: "processing",
    transfer,
  });
});
