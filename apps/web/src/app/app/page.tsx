"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronDown, Copy, Loader2, Wallet, Sparkles } from "lucide-react";
import type { AssetKey, CreateOrderInput, Institution, Order } from "@/lib/clova";
import { cn } from "@/lib/utils";
import { erc20Abi, parseUnits } from "viem";
import { useAccount, useConnect, useDisconnect, useSwitchChain, useWriteContract, usePublicClient } from "wagmi";
import { base, celo } from "viem/chains";

const CORRIDORS = ["NGN", "KES", "GHS", "UGX", "TZS", "MWK", "BRL", "XOF", "INR"] as const;

const ASSETS: Array<{ key: AssetKey; label: string; chainLabel: string; kind: "evm" | "stacks"; decimals: number; tokenAddress?: `0x${string}`; chainId?: number }> = [
  { key: "cUSD_CELO", label: "cUSD", chainLabel: "Celo", kind: "evm", decimals: 18, tokenAddress: "0x765DE816845861e75A25fCA122bb6898B8B1282a", chainId: celo.id },
  { key: "USDC_BASE", label: "USDC", chainLabel: "Base", kind: "evm", decimals: 6, tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913", chainId: base.id },
  { key: "USDCX_STACKS", label: "USDCx", chainLabel: "Stacks", kind: "stacks", decimals: 6 },
];

function shorten(s: string, head = 6, tail = 4) {
  if (!s) return s;
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}...${s.slice(-tail)}`;
}

function money(n: string | number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n);
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

type FlowState =
  | { kind: "editing" }
  | { kind: "creating_order" }
  | { kind: "awaiting_wallet"; order: Order }
  | { kind: "deposit_sent"; order: Order; txHash?: string }
  | { kind: "confirming"; order: Order; txHash: string }
  | { kind: "done"; order: Order; txHash?: string }
  | { kind: "error"; message: string };

export const dynamic = "force-dynamic";

async function loadStacks() {
  // Lazy-load to avoid SSR/prerender issues
  return await import("@/lib/stacks");
}

export default function AppPage() {
  const [asset, setAsset] = useState<AssetKey>("USDC_BASE");
  const [amountCrypto, setAmountCrypto] = useState<string>("10");
  const [destinationCurrency, setDestinationCurrency] = useState<(typeof CORRIDORS)[number]>("NGN");

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankCode, setBankCode] = useState<string>("");

  const [recipientName, setRecipientName] = useState<string>("");
  const [recipientAccount, setRecipientAccount] = useState<string>("");

  const [quote, setQuote] = useState<{ rate: string; feeFiat: string; receiveFiat: string } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const [flow, setFlow] = useState<FlowState>({ kind: "editing" });

  const assetMeta = useMemo(() => ASSETS.find((a) => a.key === asset)!, [asset]);

  // ----- EVM wallet (Wagmi) -----
  const { address, chainId, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // ----- Stacks wallet (Leather via Stacks Connect) -----
  const [stacksConnected, setStacksConnected] = useState(false);
  const [stxAddress, setStxAddress] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const stacks = await loadStacks();
        const s = stacks.getStacksAuthState();
        setStacksConnected(s.connected);
        setStxAddress(s.stxAddress);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Institutions list per currency
  useEffect(() => {
    let mounted = true;
    (async () => {
      setBanksLoading(true);
      try {
        const r = await fetch(`/api/clova/banks?currency=${destinationCurrency}`, { cache: "no-store" });
        const d = await r.json();
        const list = (d?.institutions || []) as Array<any>;
        const mapped = list
          .map((x) => ({
            name: String(x?.name || x?.institutionName || x?.label || ""),
            code: String(x?.code || x?.institutionCode || x?.id || ""),
          }))
          .filter((x) => x.name && x.code);
        if (!mounted) return;
        setInstitutions(mapped);
        setBankCode((prev) => prev || mapped[0]?.code || "");
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted) setBanksLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [destinationCurrency]);

  // Live quote preview
  useEffect(() => {
    let mounted = true;
    const t = setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const r = await fetch(`/api/clova/quotes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asset, amountCrypto, destinationCurrency }),
        });
        const d = await r.json();
        if (!mounted) return;
        if (!r.ok) {
          setQuote(null);
          return;
        }
        setQuote({ rate: String(d.rate), feeFiat: String(d.feeFiat), receiveFiat: String(d.receiveFiat) });
      } catch {
        if (!mounted) return;
        setQuote(null);
      } finally {
        if (mounted) setQuoteLoading(false);
      }
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [asset, amountCrypto, destinationCurrency]);

  async function connectEvmWallet() {
    if (!connectors.length) throw new Error("No wallet connectors available");
    // Prefer injected first; if on mobile, WalletConnect deep link will be offered too.
    return await connectAsync({ connector: connectors[0] });
  }

  async function ensureEvmChain(targetChainId: number) {
    if (!chainId) return;
    if (chainId === targetChainId) return;
    await switchChainAsync({ chainId: targetChainId });
  }

  async function createOrder(): Promise<Order> {
    if (!recipientName.trim()) throw new Error("Recipient name is required");
    if (!recipientAccount.trim() || recipientAccount.trim().length < 7) throw new Error("Account number is too short");
    if (!bankCode) throw new Error("Pick a bank/institution");

    const payload: CreateOrderInput = {
      asset,
      amountCrypto,
      destinationCurrency,
      recipient: {
        accountName: recipientName.trim(),
        accountNumber: recipientAccount.trim(),
        bankCode,
      },
      // If the user is connected on EVM, use it as return address for failure refunds.
      returnAddress: address || undefined,
    };

    const r = await fetch(`/api/clova/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.userMessage || d?.detail || d?.error || "Failed to create order");
    return d as Order;
  }

  async function sendDepositEvm(order: Order): Promise<`0x${string}`> {
    if (!assetMeta.tokenAddress || !assetMeta.chainId) throw new Error("Unsupported EVM asset config");
    if (!address) throw new Error("Connect a wallet first");

    await ensureEvmChain(assetMeta.chainId);

    const value = parseUnits(order.amountCrypto, assetMeta.decimals);
    const txHash = await writeContractAsync({
      address: assetMeta.tokenAddress,
      abi: erc20Abi,
      functionName: "transfer",
      args: [order.depositAddress as `0x${string}`, value],
      account: address,
    });

    return txHash;
  }

  async function confirmDeposit(order: Order, txHash: string) {
    const r = await fetch(`/api/clova/settlements/credited`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.orderId,
        asset: order.asset,
        amountCrypto: order.amountCrypto,
        txHash,
        confirmations: 1,
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.detail || d?.error || "Failed to confirm deposit");
    return d;
  }

  async function onCashout() {
    try {
      let currentAddress = address;
      let currentStxAddress = stxAddress;

      // 1. Connection and balance checks before creating order
      if (assetMeta.kind === "evm") {
        if (!isConnected || !currentAddress) {
          const res = await connectEvmWallet();
          if (res && res.accounts && res.accounts.length > 0) {
            currentAddress = res.accounts[0] as `0x${string}`;
          } else {
            throw new Error("Failed to connect EVM wallet");
          }
        }
        await ensureEvmChain(assetMeta.chainId!);
        
        if (publicClient && currentAddress && assetMeta.tokenAddress) {
          try {
            const bal = await publicClient.readContract({
              address: assetMeta.tokenAddress,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [currentAddress as `0x${string}`],
            });
            const needed = parseUnits(amountCrypto, assetMeta.decimals);
            if ((bal as bigint) < needed) {
              throw new Error(`Insufficient balance. You need at least ${amountCrypto} ${assetMeta.label}.`);
            }
          } catch (err: any) {
             if (err?.message?.includes("Insufficient balance") || err?.message?.includes("at least")) throw err;
             console.warn("Could not retrieve balance", err);
          }
        }
      } else {
        if (!stacksConnected || !currentStxAddress) {
          const stacks = await loadStacks();
          await stacks.connectLeather();
          const s = stacks.getStacksAuthState();
          if (!s.connected || !s.stxAddress) {
            throw new Error("Leather wallet not connected");
          }
          setStacksConnected(true);
          setStxAddress(s.stxAddress);
          currentStxAddress = s.stxAddress;
        }
      }

      setFlow({ kind: "creating_order" });
      const order = await createOrder();

      if (assetMeta.kind === "evm") {
        setFlow({ kind: "awaiting_wallet", order });
        const txHash = await sendDepositEvm(order);
        setFlow({ kind: "deposit_sent", order, txHash });

        setFlow({ kind: "confirming", order, txHash });
        await confirmDeposit(order, txHash);
        setFlow({ kind: "done", order, txHash });
        return;
      }

      setFlow({ kind: "deposit_sent", order });
    } catch (e: any) {
      setFlow({ kind: "error", message: e?.message || String(e) });
    }
  }

  const cta = useMemo(() => {
    if (flow.kind === "creating_order") return { label: "Creating order…", disabled: true };
    if (flow.kind === "awaiting_wallet") return { label: "Confirm in wallet…", disabled: true };
    if (flow.kind === "confirming") return { label: "Processing…", disabled: true };
    if (flow.kind === "done") return { label: "Done", disabled: true };
    return { label: "Cash out", disabled: false };
  }, [flow.kind]);

  return (
    <div className="min-h-screen bg-[#050C1A] text-zinc-50 relative overflow-x-hidden selection:bg-blue-500 selection:text-white">
      {/* Dynamic Background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-0 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 mx-auto max-w-xl px-4 pt-12 md:pt-20 pb-48">
        <motion.div 
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           className="flex items-start justify-between gap-3 mb-8"
        >
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Cash out</h1>
            <p className="mt-2 text-sm text-blue-200/60">Borderless stablecoin to fiat conversion.</p>
          </div>

          <div className="text-right">
            {assetMeta.kind === "evm" ? (
              <button
                onClick={async () => {
                  try {
                    if (isConnected) await disconnectAsync();
                    else await connectEvmWallet();
                  } catch (e: any) {
                    setFlow({ kind: "error", message: e?.message || "Wallet action failed" });
                  }
                }}
                className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-all shadow-[0_0_20px_-10px_rgba(59,130,246,0.5)] hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.6)]"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <Wallet className="h-3 w-3" />
                </div>
                {isConnected && address ? shorten(address) : "Connect"}
              </button>
            ) : (
              <button
                onClick={async () => {
                  try {
                    const stacks = await loadStacks();
                    await stacks.connectLeather();
                    const s = stacks.getStacksAuthState();
                    setStacksConnected(s.connected);
                    setStxAddress(s.stxAddress);
                  } catch (e: any) {
                    setFlow({ kind: "error", message: e?.message || "Wallet action failed" });
                  }
                }}
                className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-all shadow-[0_0_20px_-10px_rgba(59,130,246,0.5)] hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.6)]"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <Wallet className="h-3 w-3" />
                </div>
                {stacksConnected && stxAddress ? shorten(stxAddress) : "Connect"}
              </button>
            )}
          </div>
        </motion.div>

        <AnimatePresence>
          {flow.kind === "error" && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 rounded-[1.5rem] border border-red-500/30 bg-red-500/10 backdrop-blur-md px-5 py-4 text-sm text-red-200 shadow-[0_0_30px_-10px_rgba(239,68,68,0.3)]"
            >
              {flow.message}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-6 relative">
          {/* Send */}
          <Card title="Transfer Details" delay={0.1}>
            <div className="grid gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Asset</Label>
                  <div className="relative">
                    <select
                      value={asset}
                      onChange={(e) => setAsset(e.target.value as AssetKey)}
                      className="w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white shadow-inner focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                    >
                      {ASSETS.map((a) => (
                        <option key={a.key} value={a.key} className="bg-zinc-900">
                          {a.label} ({a.chainLabel})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <Label>Payout</Label>
                  <div className="relative">
                    <select
                      value={destinationCurrency}
                      onChange={(e) => setDestinationCurrency(e.target.value as any)}
                      className="w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white shadow-inner focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                    >
                      {CORRIDORS.map((c) => (
                        <option key={c} value={c} className="bg-zinc-900">
                          {c}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Amount</Label>
                  <div className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md">{amountCrypto} {assetMeta.label}</div>
                </div>
                <input
                  type="range"
                  min={"1"}
                  max={"500"}
                  step={"1"}
                  value={Number(amountCrypto || 0)}
                  onChange={(e) => setAmountCrypto(String(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <input
                  value={amountCrypto}
                  onChange={(e) => setAmountCrypto(e.target.value)}
                  inputMode="decimal"
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg font-semibold text-white shadow-inner focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                  placeholder="10"
                />
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-[0_0_30px_-15px_rgba(16,185,129,0.2)]">
                <div className="text-xs font-medium text-emerald-400/80 uppercase tracking-widest">Recipient gets (Estimated)</div>
                <div className="mt-2 text-3xl font-extrabold tracking-tight text-white drop-shadow-md">
                  {quoteLoading ? "…" : quote ? `${money(quote.receiveFiat)} ${destinationCurrency}` : "—"}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-white/5 pt-3">
                  <span>Network + Conversion Fee</span>
                  <span className="font-mono">{quoteLoading ? "…" : quote ? `${money(quote.feeFiat)} ${destinationCurrency}` : "—"}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Recipient */}
          <Disclosure title="Recipient details" subtitle={recipientName ? `${recipientName} • ${bankCode || ""}` : "Bank, account & name"} delay={0.2}>
            <div className="grid gap-4 pt-2">
              <div>
                <Label>Full name</Label>
                <input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white shadow-inner focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <Label>Bank / institution</Label>
                <div className="relative">
                  <select
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white shadow-inner focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all disabled:opacity-50"
                    disabled={banksLoading}
                  >
                    {institutions.map((b) => (
                      <option key={b.code} value={b.code} className="bg-zinc-900">
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <div className="mt-1 flex items-center h-4 text-xs text-gray-500">{banksLoading ? "Loading institutions…" : ""}</div>
              </div>

              <div>
                <Label>Account number</Label>
                <input
                  value={recipientAccount}
                  onChange={(e) => setRecipientAccount(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white shadow-inner focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
                  placeholder="0123456789"
                />
              </div>
            </div>
          </Disclosure>

          {/* After order */}
          <AnimatePresence>
            {(flow.kind === "awaiting_wallet" || flow.kind === "deposit_sent" || flow.kind === "confirming" || flow.kind === "done") && "order" in flow && (
              <Card title="Order Status" delay={0.3}>
                <div className="grid gap-4 text-sm">
                  <Row label="Order ID" value={shorten(flow.order.orderId, 10, 6)} mono />
                  <Row label="Current State" value={<span className="capitalize text-blue-400">{flow.kind.replace('_', ' ')}</span>} />

                  {flow.order.asset === "USDCX_STACKS" && (
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 mt-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">Stacks Manual Deposit</div>
                      <div className="mt-2 text-sm text-gray-300 leading-relaxed">
                        Open Leather and send <span className="font-mono text-white bg-white/10 px-1 rounded">{flow.order.amountCrypto} USDCx</span> to the following contract using the specific memo.
                      </div>
                      <div className="mt-4">
                        <div className="text-xs text-gray-500 mb-1">Contract Address</div>
                        <div className="flex items-center justify-between gap-2 bg-black/40 rounded-xl p-2 border border-white/5">
                          <div className="font-mono text-xs text-blue-200 truncate">{flow.order.depositAddress}</div>
                          <CopyButton value={flow.order.depositAddress} />
                        </div>
                      </div>
                      {(flow.order as any).depositMemo && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-500 mb-1">Deposit Memo</div>
                          <div className="flex items-center justify-between gap-2 bg-black/40 rounded-xl p-2 border border-white/5">
                            <div className="font-mono text-xs text-blue-200 truncate">{String((flow.order as any).depositMemo)}</div>
                            <CopyButton value={String((flow.order as any).depositMemo)} />
                          </div>
                        </div>
                      )}
                      <div className="mt-4 text-xs text-gray-400 border-t border-white/10 pt-3">
                        After confirming the transaction, paste the TX hash below to complete setup.
                      </div>
                    </div>
                  )}

                  {flow.kind === "deposit_sent" && (flow as any).txHash && <Row label="Transaction Hash" value={shorten((flow as any).txHash, 12, 10)} mono />}
                  {flow.kind === "done" && (
                    <motion.div 
                       initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                       className="mt-2 inline-flex items-center gap-2 text-emerald-400 font-medium bg-emerald-500/10 px-4 py-2 rounded-xl"
                    >
                       <CheckCircle2 className="h-5 w-5" /> Cashout complete and queued!
                    </motion.div>
                  )}
                </div>
              </Card>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="absolute inset-0 bg-gradient-to-t from-[#050C1A] to-transparent pointer-events-none" />
        <div className="relative border-t border-white/10 glassmorphism shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
           <div className="mx-auto max-w-xl px-4 py-6">
             <button
               onClick={onCashout}
               disabled={cta.disabled}
               className={cn(
                 "group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-4 text-lg font-semibold text-white shadow-[0_0_40px_-10px_rgba(59,130,246,0.6)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#050C1A] transition-all",
                 cta.disabled ? "opacity-60 grayscale cursor-not-allowed" : "hover:-translate-y-1 hover:shadow-[0_0_60px_-15px_rgba(59,130,246,0.8)]"
               )}
             >
               {!cta.disabled && (
                 <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)] pointer-events-none">
                    <div className="relative h-full w-12 bg-white/20" />
                 </div>
               )}
               <span className="relative flex items-center justify-center gap-2 drop-shadow-md">
                 {cta.disabled && <Loader2 className="h-5 w-5 animate-spin" />}
                 {cta.label}
               </span>
             </button>

             <p className="mt-3 text-center text-xs text-gray-400 flex items-center justify-center gap-1">
                You’ll approve a single secure wallet transaction.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, delay = 0, children }: { title: string; delay?: number; children: React.ReactNode }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8 shadow-2xl overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50"></div>
      <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2">
         <Sparkles className="w-4 h-4" /> {title}
      </div>
      <div>{children}</div>
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs font-semibold tracking-wide text-gray-400 uppercase">{children}</div>;
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className={cn("text-sm text-gray-200", mono ? "font-mono" : "")}>{value}</div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={cn(
        "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1",
        copied ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
      )}
    >
      {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Disclosure({
  title,
  subtitle,
  delay = 0,
  children,
}: {
  title: string;
  subtitle: string;
  delay?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-50"></div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-6 md:px-8 py-5 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors group"
      >
        <div className="text-left flex-1 min-w-0">
          <div className="text-xs font-bold text-gray-300 uppercase tracking-widest">{title}</div>
          <div className="mt-1 text-sm text-gray-500 truncate">{subtitle}</div>
        </div>
        <div className={cn("flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/10 transition-transform duration-300 group-hover:bg-white/10", open ? "rotate-180" : "")}>
           <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
      </button>
      <AnimatePresence>
        {open && (
           <motion.div 
             initial={{ height: 0, opacity: 0 }}
             animate={{ height: "auto", opacity: 1 }}
             exit={{ height: 0, opacity: 0 }}
             transition={{ duration: 0.3 }}
             className="px-6 md:px-8 pb-6 md:pb-8 overflow-hidden"
           >
              {children}
           </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
