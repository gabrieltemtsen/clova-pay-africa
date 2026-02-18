import { Router } from "express";
import { z } from "zod";
import { config } from "../lib/config.js";
import { processCredited } from "../lib/settlementEngine.js";

export const watcherRouter = Router();

const depositSchema = z.object({
  quoteId: z.string().optional(),
  orderId: z.string().optional(),
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

  if (!parsed.data.quoteId && !parsed.data.orderId) {
    return res.status(400).json({ error: "quoteId_or_orderId_required" });
  }

  const out = await processCredited({ ...parsed.data, source: "watcher" });
  if ((out as any)?.error) {
    return res.status(202).json({ accepted: false, ...out });
  }
  return res.json({ accepted: true, ...out });
});
