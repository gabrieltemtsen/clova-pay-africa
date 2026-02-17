import { Router } from "express";
import { z } from "zod";
import { config } from "../lib/config.js";
import { processCredited } from "../lib/settlementEngine.js";

export const watcherRouter = Router();

const depositSchema = z.object({
  quoteId: z.string(),
  asset: z.enum(["cUSD_CELO", "USDC_BASE", "USDCX_STACKS"]),
  amountCrypto: z.string(),
  txHash: z.string(),
  confirmations: z.number().int().nonnegative().default(1),
  providerId: z.string().optional(),
});

watcherRouter.post("/v1/watchers/deposits", async (req, res) => {
  const auth = req.header("x-watcher-token") || "";
  if (config.watcherAuthToken && auth !== config.watcherAuthToken) {
    return res.status(401).json({ error: "invalid_watcher_token" });
  }

  const parsed = depositSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const min = config.minConfirmations[parsed.data.asset];
  if (parsed.data.confirmations < min) {
    return res.status(202).json({
      accepted: false,
      reason: "insufficient_confirmations",
      required: min,
      current: parsed.data.confirmations,
    });
  }

  const out = await processCredited({ ...parsed.data, source: "watcher" });
  return res.json({ accepted: true, ...out });
});
