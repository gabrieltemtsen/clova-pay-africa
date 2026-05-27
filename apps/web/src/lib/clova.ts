export type AssetKey =
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
  | "USDCX_STACKS";

export type Institution = {
  name: string;
  code: string;
};

export type Order = {
  orderId: string;
  asset: AssetKey;
  amountCrypto: string;
  rate: string;
  feeBps: number;
  feeFiat: string;
  receiveFiat: string;
  depositAddress: string;
  destinationCurrency?: string;
  recipientName: string;
  recipientAccount: string;
  recipientBankCode: string;
  paycrestOrderId?: string;
  status: string;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
  txHash?: string;
  direction?: "onramp" | "offramp";
  recipientAddress?: string;
  providerAccount?: {
    institution: string;
    accountIdentifier: string;
    accountName: string;
    amountToTransfer: string;
    currency: string;
    validUntil?: string;
  };
};

export type CreateOrderInput = {
  asset: AssetKey;
  amountCrypto: string;
  destinationCurrency: string;
  recipient: {
    accountName: string;
    accountNumber: string;
    bankCode: string;
  };
  returnAddress?: string;
};

export type CreditedInput = {
  orderId: string;
  asset: AssetKey;
  amountCrypto: string;
  txHash: string;
  confirmations?: number;
};
