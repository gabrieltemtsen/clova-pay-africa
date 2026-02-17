import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { getOfframpRate } from "./rateProvider.js";
import type { QuoteRequest, QuoteResponse } from "./types.js";

export async function makeQuote(input: QuoteRequest): Promise<QuoteResponse> {
  const amount = Number(input.amountCrypto);

  // Fetch live rate with company margin baked in
  const { marketRate, offrampRate, marginPct } = await getOfframpRate();

  const grossNgn = amount * offrampRate;
  const feeNgn = (grossNgn * config.defaultFeeBps) / 10000;
  const receive = grossNgn - feeNgn;

  return {
    quoteId: `q_${randomUUID()}`,
    asset: input.asset,
    amountCrypto: input.amountCrypto,
    rate: String(offrampRate),
    feeBps: config.defaultFeeBps,
    feeNgn: feeNgn.toFixed(2),
    receiveNgn: receive.toFixed(2),
    expiresAt: Date.now() + 5 * 60 * 1000,
    _rateInfo: {
      marketRate: marketRate.toFixed(2),
      offrampRate: offrampRate.toFixed(2),
      marginPct,
      spreadProfit: ((amount * marketRate) - (amount * offrampRate)).toFixed(2),
    },
  };
}
