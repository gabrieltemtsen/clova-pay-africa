import { Router } from "express";
import { z } from "zod";

/**
 * Settlement state machine hook (scaffold).
 * In the next phase, this endpoint will be triggered by onchain deposit watchers.
 */
export const settlementRouter = Router();

const settledSchema = z.object({
  quoteId: z.string(),
  asset: z.enum(["cUSD_CELO", "USDC_BASE", "USDCX_STACKS"]),
  amountCrypto: z.string(),
  txHash: z.string(),
  confirmations: z.number().int().nonnegative().default(1),
});

settlementRouter.post("/v1/settlements/credited", (req, res) => {
  const parsed = settledSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  return res.json({
    settlementId: `st_${Date.now()}`,
    status: "credited",
    ...parsed.data,
    acknowledgedAt: Date.now(),
  });
});
