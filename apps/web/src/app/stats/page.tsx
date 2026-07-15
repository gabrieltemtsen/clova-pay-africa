"use client";

import { useCallback, useEffect, useState } from "react";

type StatsResponse = {
  ok: boolean;
  generatedAt: number;
  totals: {
    orders: number;
    settlements: number;
    payouts: number;
    byStatus: Record<string, number>;
    byAsset: Record<string, number>;
    volume: {
      crypto: Record<string, number>;
      fiat: number;
      fiatByCurrency: Record<string, number>;
    };
  };
  x402: {
    totalCalls: number;
    calls30d: number;
    distinctPayers: number;
    distinctPayers30d: number;
    byEndpoint: Record<string, number>;
    lastEvents: {
      endpoint: string;
      method: string;
      payer: string | null;
      network: string;
      price: string;
      createdAt: number;
    }[];
  };
  series: { date: string; orders: number; x402Calls: number }[];
  lastTxs: {
    asset: string;
    txHash: string;
    explorerUrl: string;
    amountCrypto: string;
    createdAt: number;
  }[];
  lastOrders: {
    orderId: string;
    asset: string;
    amountCrypto: string;
    destinationCurrency: string;
    status: string;
    txExplorerUrl: string | null;
    createdAt: number;
  }[];
};

const STATUS_COLORS: Record<string, string> = {
  settled: "bg-emerald-500/15 text-emerald-400",
  paid_out: "bg-emerald-500/15 text-emerald-400",
  confirming: "bg-sky-500/15 text-sky-400",
  awaiting_deposit: "bg-amber-500/15 text-amber-400",
  failed: "bg-rose-500/15 text-rose-400",
  expired: "bg-zinc-500/15 text-zinc-400",
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[status] || "bg-slate-500/15 text-slate-400"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ActivityBars({ series }: { series: StatsResponse["series"] }) {
  const max = Math.max(1, ...series.map((d) => d.orders + d.x402Calls));
  return (
    <div className="flex h-28 items-end gap-[3px]">
      {series.map((d) => {
        const total = d.orders + d.x402Calls;
        const h = Math.max(total > 0 ? 6 : 2, Math.round((total / max) * 100));
        const orderShare = total > 0 ? d.orders / total : 0;
        return (
          <div
            key={d.date}
            className="group relative flex-1 overflow-hidden rounded-sm bg-slate-800"
            style={{ height: `${h}%` }}
            title={`${d.date}: ${d.orders} orders, ${d.x402Calls} agent calls`}
          >
            <div className="absolute bottom-0 w-full bg-sky-500/80" style={{ height: `${orderShare * 100}%` }} />
            <div className="absolute top-0 w-full bg-violet-500/70" style={{ height: `${(1 - orderShare) * 100}%` }} />
          </div>
        );
      })}
    </div>
  );
}

export default function StatsPage() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/clova/stats", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as StatsResponse;
      if (!json.ok) throw new Error("bad response");
      setData(json);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e: any) {
      setError(e?.message || "failed to load");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const t = data?.totals;
  const x = data?.x402;

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-slate-200 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Clova Pay — Live Network Stats</h1>
            <p className="mt-1 text-sm text-slate-500">
              Public, real-time transparency dashboard. Settlements link to on-chain explorers — verify everything yourself.
            </p>
          </div>
          <div className="text-xs text-slate-500">
            {error ? (
              <span className="text-rose-400">stats unavailable — retrying…</span>
            ) : updatedAt ? (
              <span>updated {timeAgo(updatedAt)} · auto-refreshes every 30s</span>
            ) : (
              <span>loading…</span>
            )}
          </div>
        </header>

        {/* Headline metrics */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Card label="Orders" value={t ? fmt(t.orders) : "—"} />
          <Card label="Settlements" value={t ? fmt(t.settlements) : "—"} sub="on-chain verified" />
          <Card label="Payouts" value={t ? fmt(t.payouts) : "—"} sub="bank / mobile wallet" />
          <Card label="Fiat volume" value={t ? fmt(t.volume.fiat) : "—"} sub={t ? Object.keys(t.volume.fiatByCurrency).join(" · ") || "NGN" : ""} />
          <Card label="Agent calls (x402)" value={x ? fmt(x.totalCalls) : "—"} sub={x ? `${fmt(x.calls30d)} in last 30d` : ""} />
          <Card label="Distinct agents" value={x ? fmt(x.distinctPayers) : "—"} sub={x ? `${fmt(x.distinctPayers30d)} active 30d` : ""} />
        </section>

        {/* Activity chart */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Activity — last 30 days</h2>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-sky-500/80" /> orders</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-violet-500/70" /> x402 agent calls</span>
            </div>
          </div>
          {data ? <ActivityBars series={data.series} /> : <div className="h-28 animate-pulse rounded bg-slate-800/50" />}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Volume by asset + status */}
          <section className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-300">Crypto volume by asset</h2>
              <div className="space-y-2">
                {t && Object.keys(t.volume.crypto).length > 0 ? (
                  Object.entries(t.volume.crypto).map(([asset, vol]) => (
                    <div key={asset} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-slate-400">{asset}</span>
                      <span className="text-slate-200">{fmt(vol)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-600">no data yet</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-300">Orders by status</h2>
              <div className="flex flex-wrap gap-2">
                {t ? (
                  Object.entries(t.byStatus)
                    .filter(([, n]) => n > 0)
                    .map(([status, n]) => (
                      <span key={status} className="flex items-center gap-1.5">
                        <StatusBadge status={status} />
                        <span className="text-sm text-slate-400">{n}</span>
                      </span>
                    ))
                ) : (
                  <div className="text-sm text-slate-600">loading…</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-300">x402 calls by endpoint</h2>
              <div className="space-y-2">
                {x && Object.keys(x.byEndpoint).length > 0 ? (
                  Object.entries(x.byEndpoint)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 8)
                    .map(([ep, n]) => (
                      <div key={ep} className="flex items-center justify-between text-sm">
                        <span className="font-mono text-slate-400">{ep}</span>
                        <span className="text-slate-200">{fmt(n)}</span>
                      </div>
                    ))
                ) : (
                  <div className="text-sm text-slate-600">no paid agent calls recorded yet</div>
                )}
              </div>
            </div>
          </section>

          {/* Recent settlements + agent calls */}
          <section className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-300">Recent on-chain settlements</h2>
              <div className="space-y-2">
                {data && data.lastTxs.length > 0 ? (
                  data.lastTxs.slice(0, 8).map((s) => (
                    <div key={s.txHash} className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-mono text-slate-400">{s.asset}</span>
                      <span className="text-slate-200">{fmt(Number(s.amountCrypto))}</span>
                      <span className="text-xs text-slate-500">{timeAgo(s.createdAt)}</span>
                      {s.explorerUrl ? (
                        <a
                          href={s.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-sky-400 hover:text-sky-300"
                        >
                          {s.txHash.slice(0, 8)}… ↗
                        </a>
                      ) : (
                        <span className="font-mono text-xs text-slate-600">{s.txHash.slice(0, 8)}…</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-600">no settlements yet</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-300">Recent x402 agent calls</h2>
              <div className="space-y-2">
                {x && x.lastEvents.length > 0 ? (
                  x.lastEvents.slice(0, 8).map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-mono text-xs text-slate-400">{e.method} {e.endpoint}</span>
                      <span className="font-mono text-xs text-violet-400">{e.payer || "unknown"}</span>
                      <span className="text-xs text-slate-500">{e.price}</span>
                      <span className="text-xs text-slate-600">{timeAgo(e.createdAt)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-600">no paid agent calls recorded yet</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-300">Recent orders</h2>
              <div className="space-y-2">
                {data && data.lastOrders.length > 0 ? (
                  data.lastOrders.slice(0, 8).map((o) => (
                    <div key={o.orderId} className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-mono text-xs text-slate-400">
                        {fmt(Number(o.amountCrypto))} {o.asset} → {o.destinationCurrency}
                      </span>
                      <StatusBadge status={o.status} />
                      <span className="text-xs text-slate-600">{timeAgo(o.createdAt)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-600">no orders yet</div>
                )}
              </div>
            </div>
          </section>
        </div>

        <footer className="border-t border-slate-800 pt-4 text-xs text-slate-600">
          All settlement data is verifiable on-chain via the linked explorers. Raw data:{" "}
          <a href="/api/clova/stats" className="text-sky-500 hover:text-sky-400">JSON endpoint</a> · Source:{" "}
          <a
            href="https://github.com/gabrieltemtsen/clova-pay-africa"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-500 hover:text-sky-400"
          >
            github.com/gabrieltemtsen/clova-pay-africa
          </a>
        </footer>
      </div>
    </main>
  );
}
