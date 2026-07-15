"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ExternalLink, History, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FINAL_STATUSES,
  listStoredOrders,
  patchStoredOrder,
  type StoredOrder,
} from "@/lib/orderHistory";

const STATUS_STYLES: Record<string, string> = {
  settled: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  paid_out: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  confirming: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  awaiting_deposit: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  initiated: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  processing: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  failed: "bg-red-500/15 text-red-400 border-red-500/20",
  expired: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  refunded: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

function explorerUrl(asset: string, txHash: string): string {
  if (asset.includes("BASE")) return `https://basescan.org/tx/${txHash}`;
  if (asset.includes("CELO")) return `https://celoscan.io/tx/${txHash}`;
  if (asset.includes("ARBITRUM")) return `https://arbiscan.io/tx/${txHash}`;
  if (asset.includes("POLYGON")) return `https://polygonscan.com/tx/${txHash}`;
  if (asset.includes("ETHEREUM")) return `https://etherscan.io/tx/${txHash}`;
  if (asset.includes("BSC")) return `https://bscscan.com/tx/${txHash}`;
  if (asset.includes("SCROLL")) return `https://scrollscan.com/tx/${txHash}`;
  if (asset.includes("LISK")) return `https://blockscout.lisk.com/tx/${txHash}`;
  if (asset.includes("STACKS")) return `https://explorer.hiro.so/txid/${txHash}?chain=mainnet`;
  return "";
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function money(n: string | number | undefined) {
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n ?? "");
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function OrderHistory({ addresses = [] }: { addresses?: (string | undefined)[] }) {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [serverOrders, setServerOrders] = useState<StoredOrder[]>([]);

  const addrKey = addresses.filter(Boolean).join(",");

  /* Merge: server (by wallet address, works across devices) wins over local */
  const reload = useCallback(() => {
    const local = listStoredOrders();
    const merged = new Map<string, StoredOrder>();
    for (const o of local) merged.set(o.orderId, o);
    for (const o of serverOrders) merged.set(o.orderId, { ...merged.get(o.orderId), ...o });
    setOrders(Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 50));
  }, [serverOrders]);

  /* Fetch this wallet's orders from the API (source of truth: the DB) */
  const fetchServerOrders = useCallback(async () => {
    const addrs = addrKey ? addrKey.split(",") : [];
    if (addrs.length === 0) return;
    try {
      const results = await Promise.all(
        addrs.map(async (a) => {
          const r = await fetch(`/api/clova/my-orders?address=${encodeURIComponent(a)}`, { cache: "no-store" });
          if (!r.ok) return [];
          const d = await r.json();
          return Array.isArray(d?.orders) ? d.orders : [];
        }),
      );
      setServerOrders(
        results.flat().map((o: any): StoredOrder => ({
          orderId: o.orderId,
          direction: o.direction === "onramp" ? "onramp" : "offramp",
          asset: o.asset,
          amountCrypto: o.amountCrypto,
          destinationCurrency: o.destinationCurrency || "NGN",
          receiveFiat: o.receiveFiat,
          status: o.status,
          txHash: o.txHash || undefined,
          createdAt: o.createdAt,
        })),
      );
    } catch {
      /* API unreachable — local history still shows */
    }
  }, [addrKey]);

  /* Refresh live status of any non-final orders from the API */
  const refreshStatuses = useCallback(async () => {
    setRefreshing(true);
    await fetchServerOrders();
    const pending = listStoredOrders().filter((o) => !FINAL_STATUSES.has(o.status));
    if (pending.length === 0) {
      setRefreshing(false);
      return;
    }
    await Promise.all(
      pending.slice(0, 10).map(async (o) => {
        try {
          const path =
            o.direction === "onramp"
              ? `/api/clova/onramp/order/${o.orderId}`
              : `/api/clova/orders/${o.orderId}`;
          const r = await fetch(path, { cache: "no-store" });
          if (!r.ok) return;
          const d = await r.json();
          const status = d?.status || d?.order?.status;
          const txHash = d?.txHash || d?.order?.txHash;
          if (status && status !== o.status) {
            patchStoredOrder(o.orderId, { status, ...(txHash ? { txHash } : {}) });
          } else if (txHash && !o.txHash) {
            patchStoredOrder(o.orderId, { txHash });
          }
        } catch {
          /* offline / API down — keep last known status */
        }
      }),
    );
    setRefreshing(false);
  }, [fetchServerOrders]);

  /* Re-merge whenever local storage or server results change */
  useEffect(() => {
    reload();
    const onChange = () => reload();
    window.addEventListener("clova:orders-changed", onChange);
    return () => window.removeEventListener("clova:orders-changed", onChange);
  }, [reload]);

  /* Poll: refetch server orders + pending statuses (stable unless wallet changes) */
  useEffect(() => {
    refreshStatuses();
    const t = setInterval(refreshStatuses, 20_000);
    return () => clearInterval(t);
  }, [refreshStatuses]);

  return (
    <div className="glass-card rounded-2xl border border-white/[0.06] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">Your orders</h2>
          {orders.length > 0 && (
            <span className="text-[10px] font-bold text-gray-500 bg-white/5 rounded-full px-2 py-0.5">
              {orders.length}
            </span>
          )}
        </div>
        <button
          onClick={refreshStatuses}
          className="text-gray-500 hover:text-white transition-colors p-1"
          aria-label="Refresh order statuses"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <Clock className="w-6 h-6 text-gray-600 mx-auto mb-3" />
          <p className="text-xs text-gray-500 leading-relaxed">
            No orders yet on this device.
            <br />
            Your cashouts and purchases will show up here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.04] max-h-[26rem] overflow-y-auto">
          <AnimatePresence initial={false}>
            {orders.map((o) => {
              const url = o.txHash ? explorerUrl(o.asset, o.txHash) : "";
              return (
                <motion.li
                  key={o.orderId}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {o.direction === "onramp"
                          ? `${money(o.amountCrypto)} ${o.destinationCurrency} → ${o.asset.split("_")[0]}`
                          : `${money(o.amountCrypto)} ${o.asset.split("_")[0]} → ${o.destinationCurrency}`}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500">
                        <span>{timeAgo(o.createdAt)}</span>
                        {o.receiveFiat && o.direction === "offramp" && (
                          <span className="text-gray-400">≈ {money(o.receiveFiat)} {o.destinationCurrency}</span>
                        )}
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            tx <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        STATUS_STYLES[o.status] || "bg-white/5 text-gray-400 border-white/10",
                      )}
                    >
                      {o.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
