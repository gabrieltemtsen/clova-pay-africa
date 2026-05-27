export type Asset =
  | "cUSD_CELO"
  | "USDC_BASE"
  | "USDC_ARBITRUM"
  | "USDT_ARBITRUM"
  | "USDC_POLYGON"
  | "USDT_POLYGON"
  | "USDC_ETHEREUM"
  | "USDT_ETHEREUM"
  | "USDT_BSC"
  | "USDC_BSC"
  | "USDC_SCROLL"
  | "USDT_SCROLL"
  | "USDT_LISK"
  | "USDC_LISK"
  | "USDCX_STACKS";

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
