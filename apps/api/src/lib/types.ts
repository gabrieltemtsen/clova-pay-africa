export type Asset = "cUSD_CELO" | "USDC_BASE" | "USDCX_STACKS";

export type SupportedCurrency =
  | "NGN"
  | "KES"
  | "GHS"
  | "UGX"
  | "TZS"
  | "MWK"
  | "BRL"
  | "XOF"
  | "INR";

export type QuoteRequest = {
  asset: Asset;
  amountCrypto: string;
  destinationCurrency: SupportedCurrency;
};

export type QuoteResponse = {
  quoteId: string;
  asset: Asset;
  amountCrypto: string;
  destinationCurrency: SupportedCurrency;
  rate: string;
  feeBps: number;
  feeFiat: string;
  receiveFiat: string;
  expiresAt: number;
  _rateInfo?: {
    marketRate: string;
    offrampRate: string;
    marginPct: number;
    spreadProfit: string;
  };
};
