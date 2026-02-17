export type Asset = "cUSD_CELO" | "USDC_BASE" | "USDCX_STACKS";

export type QuoteRequest = {
  asset: Asset;
  amountCrypto: string;
  destinationCurrency: "NGN";
};

export type QuoteResponse = {
  quoteId: string;
  asset: Asset;
  amountCrypto: string;
  rate: string;
  feeBps: number;
  feeNgn: string;
  receiveNgn: string;
  expiresAt: number;
  _rateInfo?: {
    marketRate: string;
    offrampRate: string;
    marginPct: number;
    spreadProfit: string;
  };
};
