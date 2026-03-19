import { STACKS_MAINNET, STACKS_TESTNET, createNetwork } from "@stacks/network";

export function getStacksNetwork() {
  const mode = (process.env.STACKS_NETWORK || "testnet").toLowerCase();
  const base = mode === "mainnet" ? STACKS_MAINNET : STACKS_TESTNET;

  // Allow overriding API baseUrl via STACKS_API_URL
  const apiUrl = process.env.STACKS_API_URL || (mode === "mainnet" ? "https://api.mainnet.hiro.so" : "https://api.testnet.hiro.so");
  return createNetwork(base, apiUrl);
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function explorerTxUrl(txid: string) {
  const mode = (process.env.STACKS_NETWORK || "testnet").toLowerCase();
  const chain = mode === "mainnet" ? "mainnet" : "testnet";
  return `https://explorer.hiro.so/txid/${txid}?chain=${chain}`;
}
