export type AssetKey =
  | "USDC_BASE"
  | "USDT_BASE"
  | "USDC_CELO"
  | "USDT_CELO"
  | "cUSD_CELO"
  | "USDC_ARBITRUM"
  | "USDT_ARBITRUM"
  | "USDC_POLYGON"
  | "USDT_POLYGON"
  | "USDC_ETHEREUM"
  | "USDT_ETHEREUM"
  | "USDT_BSC"
  | "USDC_BSC"
  | "USDCX_STACKS";

export type Institution = {
  name: string;
  code: string;
  type?: string;
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
  paymentReference?: string | null;
  status: string;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
  txHash?: string;
  direction?: "onramp" | "offramp";
  recipientAddress?: string;
  returnAddress?: string;
  providerAccount?: {
    institution?: string;
    accountIdentifier?: string;
    accountName?: string;
    receiveAddress?: string;
    network?: string;
    amountToTransfer: string;
    currency: string;
    validUntil?: string;
    memo?: string;
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
    memo?: string;
    metadata?: Record<string, unknown>;
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
