import { base, celo } from "viem/chains";

export const SUPPORTED_EVM_CHAINS = {
  base,
  celo,
} as const;

export const ASSET_EVM_CHAIN = {
  USDC_BASE: base,
  cUSD_CELO: celo,
} as const;
