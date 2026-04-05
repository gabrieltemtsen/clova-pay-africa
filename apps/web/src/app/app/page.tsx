"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Copy, Loader2, Wallet } from "lucide-react";
import type { AssetKey, CreateOrderInput, Institution, Order } from "@/lib/clova";
import { cn } from "@/lib/utils";
import { erc20Abi, parseUnits } from "viem";
import { useAccount, useConnect, useDisconnect, useSwitchChain, useWriteContract } from "wagmi";
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

const CONTROL =
  "w-full rounded-xl border border-zinc-800/80 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 " +
  "placeholder:text-zinc-600 shadow-sm shadow-black/20 transition " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40";

const CONTROL_DISABLED = "disabled:opacity-60 disabled:cursor-not-allowed";

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
    await connectAsync({ connector: connectors[0] });
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
    setFlow({ kind: "creating_order" });

    try {
      const order = await createOrder();

      // After order creation, we should immediately prompt a deposit.
      if (assetMeta.kind === "evm") {
        if (!isConnected) {
          setFlow({ kind: "awaiting_wallet", order });
          await connectEvmWallet();
        }

        setFlow({ kind: "awaiting_wallet", order });
        const txHash = await sendDepositEvm(order);
        setFlow({ kind: "deposit_sent", order, txHash });

        setFlow({ kind: "confirming", order, txHash });
        await confirmDeposit(order, txHash);
        setFlow({ kind: "done", order, txHash });
        return;
      }

      // Stacks: connect Leather and show deposit instructions (order already created)
      if (!stacksConnected) {
        const stacks = await loadStacks();
        await stacks.connectLeather();
        const s = stacks.getStacksAuthState();
        setStacksConnected(s.connected);
        setStxAddress(s.stxAddress);
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
    <div className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
      <div className="mx-auto max-w-xl px-4 pb-32 pt-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold tracking-tight">Cash out stablecoins</div>
            <div className="mt-1 text-sm text-zinc-400">Send stablecoins. Recipient gets local fiat.</div>
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
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition"
              >
                <Wallet className="h-4 w-4" />
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
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition"
              >
                <Wallet className="h-4 w-4" />
                {stacksConnected && stxAddress ? shorten(stxAddress) : "Connect"}
              </button>
            )}
          </div>
        </div>

        {flow.kind === "error" && (
          <div className="mt-4 rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {flow.message}
          </div>
        )}

        <div className="mt-6 grid gap-4">
          {/* Send */}
          <Card title="You send">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Asset</Label>
                  <select
                    value={asset}
                    onChange={(e) => setAsset(e.target.value as AssetKey)}
                    className={cn(CONTROL, CONTROL_DISABLED)}
                  >
                    {ASSETS.map((a) => (
                      <option key={a.key} value={a.key}>
                        {a.label} — {a.chainLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Payout</Label>
                  <select
                    value={destinationCurrency}
                    onChange={(e) => setDestinationCurrency(e.target.value as any)}
                    className={cn(CONTROL, CONTROL_DISABLED)}
                  >
                    {CORRIDORS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Amount</Label>
                  <div className="text-xs text-zinc-500 font-mono">{amountCrypto}</div>
                </div>
                <input
                  type="range"
                  min={"1"}
                  max={"500"}
                  step={"1"}
                  value={Number(amountCrypto || 0)}
                  onChange={(e) => setAmountCrypto(String(e.target.value))}
                  className="w-full"
                />
                <input
                  value={amountCrypto}
                  onChange={(e) => setAmountCrypto(e.target.value)}
                  inputMode="decimal"
                  className={cn("mt-2", CONTROL, CONTROL_DISABLED)}
                  placeholder="10"
                />
              </div>

              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 p-4 shadow-sm shadow-black/20">
                <div className="text-xs text-zinc-500">Recipient gets (estimated)</div>
                <div className="mt-1 min-h-[32px] text-2xl font-semibold tracking-tight tabular-nums">
                  {quoteLoading ? "…" : quote ? `${money(quote.receiveFiat)} ${destinationCurrency}` : "—"}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                  <span>Fee</span>
                  <span className="font-mono tabular-nums">{quoteLoading ? "…" : quote ? `${money(quote.feeFiat)} ${destinationCurrency}` : "—"}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Recipient */}
          <Disclosure title="Recipient details" subtitle={recipientName ? `${recipientName} • ${bankCode || ""}` : "Name, bank/mobile money, account number"}>
            <div className="grid gap-3">
              <div>
                <Label>Full name</Label>
                <input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className={cn(CONTROL, CONTROL_DISABLED)}
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <Label>Bank / institution</Label>
                <select
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  className={cn(CONTROL, CONTROL_DISABLED)}
                  disabled={banksLoading}
                >
                  {institutions.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-zinc-500">{banksLoading ? "Loading institutions…" : ""}</div>
              </div>

              <div>
                <Label>Account number</Label>
                <input
                  value={recipientAccount}
                  onChange={(e) => setRecipientAccount(e.target.value)}
                  className={cn(CONTROL, CONTROL_DISABLED)}
                  placeholder="0123456789"
                />
              </div>
            </div>
          </Disclosure>

          {/* After order */}
          {(flow.kind === "awaiting_wallet" || flow.kind === "deposit_sent" || flow.kind === "confirming" || flow.kind === "done") && "order" in flow && (
            <Card title="Status">
              <div className="grid gap-3 text-sm">
                <Row label="Order" value={shorten(flow.order.orderId, 10, 6)} mono />
                <Row label="State" value={flow.kind} />

                {flow.order.asset === "USDCX_STACKS" && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <div className="text-xs text-zinc-500">Stacks deposit</div>
                    <div className="mt-1 text-sm text-zinc-300">
                      Open Leather and send <span className="font-mono">{flow.order.amountCrypto} USDCx</span> to the contract below, using the memo.
                    </div>
                    <div className="mt-3">
                      <div className="text-xs text-zinc-500">Contract</div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <div className="font-mono text-xs break-all">{flow.order.depositAddress}</div>
                        <CopyButton value={flow.order.depositAddress} />
                      </div>
                    </div>
                    {(flow.order as any).depositMemo && (
                      <div className="mt-3">
                        <div className="text-xs text-zinc-500">Memo</div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <div className="font-mono text-xs break-all">{String((flow.order as any).depositMemo)}</div>
                          <CopyButton value={String((flow.order as any).depositMemo)} />
                        </div>
                      </div>
                    )}
                    <div className="mt-3 text-xs text-zinc-500">
                      After sending, paste the tx hash below and we’ll continue.
                    </div>
                  </div>
                )}

                {flow.kind === "deposit_sent" && (flow as any).txHash && <Row label="Tx" value={shorten((flow as any).txHash, 12, 10)} mono />}
                {flow.kind === "done" && <div className="inline-flex items-center gap-2 text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Cashout queued/completed</div>}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 py-4">
          <button
            onClick={onCashout}
            disabled={cta.disabled}
            className={cn(
              "w-full rounded-2xl bg-emerald-500 px-4 py-4 text-base font-semibold text-zinc-950 hover:bg-emerald-400 transition",
              cta.disabled ? "opacity-60" : ""
            )}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {cta.disabled && <Loader2 className="h-5 w-5 animate-spin" />}
              {cta.label}
            </span>
          </button>

          <div className="mt-2 text-center text-xs text-zinc-500">
            You’ll approve a single wallet transaction to deposit funds for the cashout.
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/40 p-4 shadow-sm shadow-black/20">
      <div className="text-sm font-semibold text-zinc-100">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-xs font-medium text-zinc-400">{children}</div>;
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={cn("text-sm text-zinc-200", mono ? "font-mono" : "")}>{value}</div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(value)}
      className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 transition"
    >
      Copy
    </button>
  );
}

function Disclosure({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/40 shadow-sm shadow-black/20">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full px-4 py-4 flex items-center justify-between gap-3 transition",
          "hover:bg-white/[0.03] active:bg-white/[0.05]",
          "focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset"
        )}
      >
        <div className="text-left">
          <div className="text-sm font-semibold text-zinc-100">{title}</div>
          <div className="mt-1 text-xs text-zinc-500">{subtitle}</div>
        </div>
        <ChevronDown className={cn("h-5 w-5 text-zinc-400 transition-transform duration-200", open ? "rotate-180" : "")} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
