import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { getOfframpRate } from "./rateProvider.js";
import type { QuoteRequest, QuoteResponse } from "./types.js";

export async function makeQuote(input: QuoteRequest): Promise<QuoteResponse> {
  const amount = Number(input.amountCrypto);
  const currency = input.destinationCurrency;

  // Fetch live rate with company margin baked in
  const { marketRate, offrampRate, marginPct } = await getOfframpRate(currency);

  const grossFiat = amount * offrampRate;
  const feeFiat = (grossFiat * config.defaultFeeBps) / 10000;
  const receiveFiat = grossFiat - feeFiat;

  return {
    quoteId: `q_${randomUUID()}`,
    asset: input.asset,
    amountCrypto: input.amountCrypto,
    destinationCurrency: currency,
    rate: String(offrampRate),
    feeBps: config.defaultFeeBps,
    feeFiat: feeFiat.toFixed(2),
    receiveFiat: receiveFiat.toFixed(2),
    expiresAt: Date.now() + 5 * 60 * 1000,
    _rateInfo: {
      marketRate: marketRate.toFixed(6),
      offrampRate: offrampRate.toFixed(6),
      marginPct,
      spreadProfit: ((amount * marketRate) - (amount * offrampRate)).toFixed(2),
    },
  };
}
