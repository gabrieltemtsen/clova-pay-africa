import { Router } from "express";
import { z } from "zod";
import { makeQuote } from "../lib/quote.js";

export const quoteRouter = Router();

const SUPPORTED_CURRENCIES = [
  "NGN",
  "KES",
  "GHS",
  "UGX",
  "TZS",
  "MWK",
  "BRL",
  "XOF",
  "INR",
] as const;

const quoteSchema = z.object({
  asset: z.enum(["cUSD_CELO", "USDC_BASE", "USDCX_STACKS"]),
  amountCrypto: z.string(),
  destinationCurrency: z.enum(SUPPORTED_CURRENCIES),
});

quoteRouter.post("/v1/quotes", async (req, res) => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  return res.json(await makeQuote(parsed.data));
});
