import { Router } from "express";
import { z } from "zod";
import { ledger } from "../lib/ledger.js";
import { processCredited } from "../lib/settlementEngine.js";

export const settlementRouter = Router();

const settledSchema = z.object({
  quoteId: z.string(),
  asset: z.enum(["cUSD_CELO", "USDC_BASE", "USDCX_STACKS"]),
  amountCrypto: z.string(),
  txHash: z.string(),
  confirmations: z.number().int().nonnegative().default(1),
  providerId: z.string().optional(),
});

settlementRouter.post("/v1/settlements/credited", async (req, res) => {
  const parsed = settledSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const out = await processCredited({
    ...parsed.data,
    source: "manual",
  });

  return res.json(out);
});

settlementRouter.get("/v1/settlements", async (_req, res) => {
  return res.json({ settlements: await ledger.listSettlements(200) });
});

settlementRouter.get("/v1/ledger/entries", async (_req, res) => {
  return res.json({ entries: await ledger.listLedgerEntries(200) });
});
