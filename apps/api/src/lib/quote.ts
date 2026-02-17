import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import type { QuoteRequest, QuoteResponse } from "./types.js";

export function makeQuote(input: QuoteRequest): QuoteResponse {
  const amount = Number(input.amountCrypto);
  const grossNgn = amount * config.defaultNgnRate;
  const feeNgn = (grossNgn * config.defaultFeeBps) / 10000;
  const receive = grossNgn - feeNgn;

  return {
    quoteId: `q_${randomUUID()}`,
    asset: input.asset,
    amountCrypto: input.amountCrypto,
    rate: String(config.defaultNgnRate),
    feeBps: config.defaultFeeBps,
    feeNgn: feeNgn.toFixed(2),
    receiveNgn: receive.toFixed(2),
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
}
