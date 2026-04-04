"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Copy, ExternalLink, Loader2, ShieldCheck, Wallet } from "lucide-react";
import type { AssetKey, CreateOrderInput, Institution, Order } from "@/lib/clova";
import { cn } from "@/lib/utils";
import { connectWallet, isMiniPay, sendErc20, type SupportedAsset } from "@/lib/wallet";

const ASSETS: Array<{ key: AssetKey; label: string; desc: string; badge: string; minipay: boolean }> = [
  { key: "cUSD_CELO", label: "cUSD", desc: "Celo", badge: "MiniPay", minipay: true },
  { key: "USDC_BASE", label: "USDC", desc: "Base", badge: "Wallet", minipay: false },
  { key: "USDCX_STACKS", label: "USDCx", desc: "Stacks", badge: "Manual", minipay: false },
];

const CORRIDORS = ["NGN", "KES", "GHS", "UGX", "TZS", "MWK", "BRL", "XOF", "INR"] as const;

function shorten(s: string, head = 6, tail = 4) {
  if (!s) return s;
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}...${s.slice(-tail)}`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium text-zinc-400 mb-1">{children}</div>;
}

export default function AppPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [asset, setAsset] = useState<AssetKey>("cUSD_CELO");
  const [amountCrypto, setAmountCrypto] = useState<string>("10");
  const [destinationCurrency, setDestinationCurrency] = useState<(typeof CORRIDORS)[number]>("NGN");

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankCode, setBankCode] = useState<string>("");

  const [recipientName, setRecipientName] = useState<string>("");
  const [recipientAccount, setRecipientAccount] = useState<string>("");

  const [order, setOrder] = useState<Order | null>(null);
  const [txHash, setTxHash] = useState<string>("");

  const [walletAddr, setWalletAddr] = useState<string>("");
  const [walletChainId, setWalletChainId] = useState<number | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const miniPay = useMemo(() => isMiniPay(), []);

  const [quotePreview, setQuotePreview] = useState<{ rate: string; feeFiat: string; receiveFiat: string } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // If a wallet is connected and the asset is supported, we can immediately prompt the deposit after creating an order.
  const [autoDeposit, setAutoDeposit] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setBanksLoading(true);
      setError(null);
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
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load banks");
      } finally {
        if (mounted) setBanksLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [destinationCurrency]);

  // Live quote preview (debounced)
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
          setQuotePreview(null);
          return;
        }
        setQuotePreview({ rate: String(d.rate), feeFiat: String(d.feeFiat), receiveFiat: String(d.receiveFiat) });
      } catch {
        if (!mounted) return;
        setQuotePreview(null);
      } finally {
        if (mounted) setQuoteLoading(false);
      }
    }, 350);

    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [asset, amountCrypto, destinationCurrency]);

  async function onConnectWallet() {
    setError(null);
    setSuccess(null);
    try {
      setBusy("Connecting wallet...");
      const out = await connectWallet();
      setWalletAddr(out.address);
      setWalletChainId(out.chainId);
      setSuccess(`Connected ${shorten(out.address)}`);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onCreateOrder() {
    setError(null);
    setSuccess(null);

    if (!recipientName.trim()) return setError("Recipient name is required");
    if (!recipientAccount.trim() || recipientAccount.trim().length < 7) return setError("Account number is too short");
    if (!bankCode) return setError("Pick a bank/institution");

    const payload: CreateOrderInput = {
      asset,
      amountCrypto,
      destinationCurrency,
      recipient: {
        accountName: recipientName.trim(),
        accountNumber: recipientAccount.trim(),
        bankCode,
      },
      returnAddress: walletAddr || undefined,
    };

    try {
      setBusy("Creating order...");
      const r = await fetch(`/api/clova/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) {
        throw new Error(d?.userMessage || d?.detail || d?.error?.message || d?.error || `Order failed (${r.status})`);
      }
      const created = d as Order;
      setOrder(created);

      // Immediately prompt the token transfer (still requires wallet confirmation).
      const canWalletPay = (asset === "cUSD_CELO" || asset === "USDC_BASE") && Boolean(walletAddr);
      if (autoDeposit && canWalletPay) {
        setStep(2);
        setSuccess("Order created. Opening wallet to deposit...");
        // Let UI paint before wallet popup.
        setTimeout(() => {
          onPayWithWallet(created);
        }, 50);
        return;
      }

      setStep(2);
      setSuccess("Order created. Next: deposit crypto.");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onPayWithWallet(targetOrder?: Order) {
    const o = targetOrder || order;
    if (!o) return;

    setError(null);
    setSuccess(null);

    if (o.asset !== "cUSD_CELO" && o.asset !== "USDC_BASE") {
      return setError("This asset currently requires a manual deposit.");
    }

    try {
      setBusy(miniPay ? "Opening MiniPay…" : "Opening wallet…");
      const supportedAsset = o.asset as SupportedAsset;
      const out = await sendErc20({
        asset: supportedAsset,
        to: o.depositAddress as `0x${string}`,
        amount: o.amountCrypto,
      });
      setTxHash(out.txHash);
      setStep(3);
      setSuccess(`Deposit sent: ${shorten(out.txHash, 10, 8)}`);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onConfirmDeposit() {
    if (!order) return;
    const hash = txHash.trim();
    if (!hash) return setError("Paste a transaction hash");

    setError(null);
    setSuccess(null);

    try {
      setBusy("Confirming deposit & triggering payout...");
      const r = await fetch(`/api/clova/settlements/credited`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.orderId,
          asset: order.asset,
          amountCrypto: order.amountCrypto,
          txHash: hash,
          confirmations: 1,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        throw new Error(d?.detail || d?.error?.message || d?.error || `Confirm failed (${r.status})`);
      }
      setStep(4);
      setSuccess("Fiat payout triggered (or queued). Track status below.");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }


  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-semibold tracking-tight">Clova Pay</div>
              <div className="text-xs rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-zinc-300">
                /app
              </div>
            </div>
            <div className="mt-1 text-sm text-zinc-400">
              Convert stablecoins to local fiat (Africa + more). MiniPay supported.
            </div>
          </div>

          <button
            onClick={onConnectWallet}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition",
              busy ? "opacity-60 pointer-events-none" : ""
            )}
          >
            <Wallet className="h-4 w-4" />
            {walletAddr ? shorten(walletAddr) : "Connect wallet"}
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-medium">Safe flow</div>
              <div className="mt-1 text-sm text-zinc-400">
                Payouts only fire after your crypto deposit is confirmed. No money leaves until you send stablecoins.
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                Supported corridors: {CORRIDORS.join(", ")}. ZAR is not supported.
              </div>
            </div>
          </div>
        </div>

        {(error || success || busy) && (
          <div className="mt-4 grid gap-2">
            {busy && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {busy}
              </div>
            )}
            {error && <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</div>}
            {success && (
              <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-200 inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {success}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 grid gap-4">
          {/* Step 1 */}
          <Card active={step === 1} done={step > 1} title="1) Create an order" subtitle="Choose asset, corridor, and recipient details.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Asset</FieldLabel>
                <select
                  value={asset}
                  onChange={(e) => setAsset(e.target.value as AssetKey)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                >
                  {ASSETS.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label} — {a.desc}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-zinc-500">
                  {asset === "cUSD_CELO" && (miniPay ? "MiniPay detected ✅" : "Open in Opera MiniPay for 1-tap deposits")}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <FieldLabel>Amount (stablecoin)</FieldLabel>
                  <div className="text-xs text-zinc-500 font-mono">{amountCrypto || "0"}</div>
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
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  placeholder="10"
                />

                <div className="mt-1 text-xs text-zinc-500">
                  Slide to pick an amount, or type it. We’ll show an estimated receive amount before you confirm.
                </div>

                <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <div className="text-xs text-zinc-500">Rate</div>
                      <div className="font-mono">{quoteLoading ? "…" : quotePreview?.rate ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Fee</div>
                      <div className="font-mono">{quoteLoading ? "…" : quotePreview ? `${quotePreview.feeFiat} ${destinationCurrency}` : "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Recipient receives</div>
                      <div className="font-mono text-emerald-300">
                        {quoteLoading ? "…" : quotePreview ? `${quotePreview.receiveFiat} ${destinationCurrency}` : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <FieldLabel>Payout currency</FieldLabel>
                <select
                  value={destinationCurrency}
                  onChange={(e) => setDestinationCurrency(e.target.value as any)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                >
                  {CORRIDORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-zinc-500">Pick where the recipient should receive funds.</div>
              </div>

              <div>
                <FieldLabel>Bank / Institution</FieldLabel>
                <select
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  disabled={banksLoading}
                >
                  {institutions.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-zinc-500">
                  {banksLoading ? "Loading institutions…" : institutions.length ? "" : "No institutions returned for this corridor."}
                </div>
              </div>

              <div>
                <FieldLabel>Recipient name</FieldLabel>
                <input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <FieldLabel>Account number (7–15 digits)</FieldLabel>
                <input
                  value={recipientAccount}
                  onChange={(e) => setRecipientAccount(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  placeholder="0123456789"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={onCreateOrder}
                className={cn(
                  "inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition",
                  busy ? "opacity-60 pointer-events-none" : ""
                )}
              >
                Continue
              </button>

              <label className="flex items-center gap-2 text-xs text-zinc-400 select-none">
                <input
                  type="checkbox"
                  checked={autoDeposit}
                  onChange={(e) => setAutoDeposit(e.target.checked)}
                  className="accent-emerald-500"
                />
                After I create the order, prompt my wallet to deposit automatically (recommended)
              </label>

              <div className="text-xs text-zinc-500">
                Tip: for MiniPay, connect wallet first so the deposit can happen right after you continue.
              </div>
            </div>
          </Card>

          {/* Step 2 */}
          <Card active={step === 2} done={step > 2} title="2) Deposit stablecoins" subtitle="Send the exact amount to the deposit address.">
            {!order ? (
              <div className="text-sm text-zinc-400">Create an order to get a deposit address.</div>
            ) : (
              <div className="grid gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <div className="text-xs text-zinc-500">Order</div>
                  <div className="mt-1 font-mono text-sm">{order.orderId}</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3 text-sm">
                    <div>
                      <div className="text-xs text-zinc-500">Send</div>
                      <div className="font-mono text-emerald-300">{order.amountCrypto}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Asset</div>
                      <div className="font-mono">{order.asset}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Status</div>
                      <div className="font-mono">{order.status}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs text-zinc-500">Deposit address</div>
                      <div className="mt-1 font-mono text-sm break-all">{order.depositAddress}</div>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(order.depositAddress)}
                      className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800 transition"
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </button>
                  </div>

                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => onPayWithWallet()}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition",
                        busy ? "opacity-60 pointer-events-none" : ""
                      )}
                      disabled={asset === "USDCX_STACKS"}
                    >
                      <Wallet className="h-4 w-4" />
                      {miniPay && asset === "cUSD_CELO" ? "Pay with MiniPay" : "Pay with wallet"}
                    </button>

                    <button
                      onClick={() => {
                        setStep(3);
                        setSuccess("Paste your tx hash to confirm.");
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm hover:bg-zinc-800 transition"
                    >
                      I already sent it
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>

                  {!walletAddr && (
                    <div className="mt-2 text-xs text-zinc-500">
                      You can still deposit manually — but connecting a wallet enables 1-tap deposits (especially on MiniPay).
                    </div>
                  )}
                  {walletChainId != null && (
                    <div className="mt-1 text-xs text-zinc-500">Wallet chainId: {walletChainId}</div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Step 3 */}
          <Card active={step === 3} done={step > 3} title="3) Confirm deposit" subtitle="Paste the transaction hash to trigger/confirm the fiat payout.">
            {!order ? (
              <div className="text-sm text-zinc-400">Create an order first.</div>
            ) : (
              <div>
                <FieldLabel>Transaction hash</FieldLabel>
                <input
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-mono"
                  placeholder="0xabc123…"
                />
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={onConfirmDeposit}
                    className={cn(
                      "inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition",
                      busy ? "opacity-60 pointer-events-none" : ""
                    )}
                  >
                    Confirm deposit → payout
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    className="inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm hover:bg-zinc-800 transition"
                  >
                    Back
                  </button>
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  In production, this step is usually automated by watchers. For demo UX we keep it explicit.
                </div>
              </div>
            )}
          </Card>

          {/* Step 4 */}
          <Card active={step === 4} done={false} title="Done" subtitle="Track the order status (pending → paid_out → settled).">
            {!order ? (
              <div className="text-sm text-zinc-400">No order yet.</div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <div className="text-xs text-zinc-500">Order ID</div>
                  <div className="mt-1 font-mono text-sm">{order.orderId}</div>
                  <div className="mt-2 text-xs text-zinc-500">Tx</div>
                  <div className="mt-1 font-mono text-sm">{txHash ? shorten(txHash, 12, 10) : "(not provided)"}</div>
                </div>
                <button
                  onClick={async () => {
                    setError(null);
                    setSuccess(null);
                    try {
                      setBusy("Refreshing status...");
                      const r = await fetch(`/api/clova/orders/${order.orderId}`, { cache: "no-store" });
                      const d = await r.json();
                      if (!r.ok) throw new Error(d?.error || "Failed to refresh");
                      setOrder(d as Order);
                      setSuccess(`Status: ${d.status}`);
                    } catch (e: any) {
                      setError(e?.message || String(e));
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className={cn(
                    "inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm hover:bg-zinc-800 transition",
                    busy ? "opacity-60 pointer-events-none" : ""
                  )}
                >
                  Refresh status
                </button>
              </motion.div>
            )}
          </Card>
        </div>

        <div className="mt-10 text-xs text-zinc-500">
          <div className="font-medium text-zinc-400">MiniPay notes</div>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>MiniPay works best with cUSD on Celo.</li>
            <li>If network switching fails, manually set the chain in your wallet and try again.</li>
            <li>For support, open an issue on the repo with your orderId + chain + tx hash.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  active,
  done,
  children,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-zinc-950/40 p-4",
        active ? "border-emerald-500/40" : done ? "border-emerald-900/30 opacity-90" : "border-zinc-800"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-sm text-zinc-400">{subtitle}</div>
        </div>
        {done && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
