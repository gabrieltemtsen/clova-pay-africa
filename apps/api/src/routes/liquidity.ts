import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { ledger } from "../lib/ledger.js";

export const liquidityRouter = Router();

const providerSchema = z.object({
  name: z.string().min(2),
  feeBps: z.number().int().min(0).max(5000).default(150),
  initialBalanceKobo: z.number().int().nonnegative().default(0),
});

liquidityRouter.post("/v1/liquidity/providers", async (req, res) => {
  const parsed = providerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const provider = {
    providerId: `lp_${randomUUID()}`,
    name: parsed.data.name,
    currency: "NGN" as const,
    balanceKobo: parsed.data.initialBalanceKobo,
    feeBps: parsed.data.feeBps,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await ledger.upsertProvider(provider);
  return res.json(provider);
});

liquidityRouter.get("/v1/liquidity/providers", async (_req, res) => {
  return res.json({ providers: await ledger.listProviders() });
});

const adjustSchema = z.object({ deltaKobo: z.number().int() });
liquidityRouter.post("/v1/liquidity/providers/:providerId/adjust", async (req, res) => {
  const parsed = adjustSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const provider = await ledger.adjustProviderBalance(req.params.providerId, parsed.data.deltaKobo);
  if (!provider) return res.status(404).json({ error: "provider_not_found" });
  return res.json(provider);
});
