import { createPublicClient, createWalletClient, custom, erc20Abi, formatUnits, parseUnits } from "viem";
import { base, celo } from "viem/chains";

export type SupportedAsset = "cUSD_CELO" | "USDC_BASE";

const TOKEN = {
  cUSD_CELO: {
    chain: celo,
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
    symbol: "cUSD",
    decimals: 18,
  },
  USDC_BASE: {
    chain: base,
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
    symbol: "USDC",
    decimals: 6,
  },
} as const;

export function isMiniPay(): boolean {
  const w = globalThis as any;
  // MiniPay injects an EIP-1193 provider; safest UX is to treat any injected provider as usable.
  // We also check for some common Opera flags when present.
  return Boolean(w?.ethereum) && (Boolean(w?.opera) || Boolean(w?.ethereum?.isMiniPay));
}

export async function connectWallet(): Promise<{ address: string; chainId: number }> {
  const w = globalThis as any;
  if (!w?.ethereum) throw new Error("No injected wallet found. Open in Opera MiniPay or a wallet browser.");

  const wallet = createWalletClient({
    chain: undefined,
    transport: custom(w.ethereum),
  });

  const [address] = await wallet.requestAddresses();
  const chainId = await wallet.getChainId();

  return { address, chainId };
}

export async function ensureChain(asset: SupportedAsset): Promise<void> {
  const w = globalThis as any;
  if (!w?.ethereum) throw new Error("No injected wallet found");

  const target = TOKEN[asset].chain;
  const wallet = createWalletClient({ chain: undefined, transport: custom(w.ethereum) });
  const current = await wallet.getChainId();
  if (current === target.id) return;

  // Attempt to switch. MiniPay may not support programmatic switching; if it fails, we surface a clear error.
  try {
    await wallet.switchChain({ id: target.id });
  } catch {
    throw new Error(`Please switch your wallet network to ${target.name} (chainId=${target.id}) and try again.`);
  }
}

export async function sendErc20({
  asset,
  to,
  amount,
}: {
  asset: SupportedAsset;
  to: `0x${string}`;
  amount: string;
}): Promise<{ txHash: `0x${string}`; summary: string }> {
  const w = globalThis as any;
  if (!w?.ethereum) throw new Error("No injected wallet found");

  await ensureChain(asset);

  const t = TOKEN[asset];
  const wallet = createWalletClient({
    chain: t.chain,
    transport: custom(w.ethereum),
  });

  const [from] = await wallet.requestAddresses();
  const value = parseUnits(amount, t.decimals);

  const txHash = await wallet.writeContract({
    address: t.address,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, value],
    account: from,
  });

  return {
    txHash,
    summary: `Sent ${amount} ${t.symbol} to ${to}`,
  };
}

export async function getErc20Balance({
  asset,
  address,
}: {
  asset: SupportedAsset;
  address: `0x${string}`;
}): Promise<{ raw: bigint; formatted: string }> {
  const t = TOKEN[asset];
  const client = createPublicClient({ chain: t.chain, transport: custom((globalThis as any).ethereum) });
  const raw = await client.readContract({
    address: t.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
  return { raw, formatted: formatUnits(raw, t.decimals) };
}
