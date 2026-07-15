"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { Activity, ArrowUpRight } from "lucide-react";

type Stats = {
  ok: boolean;
  totals: {
    orders: number;
    settlements: number;
    payouts: number;
    volume: { fiatByCurrency: Record<string, number> };
  };
  x402: { totalCalls: number; distinctPayers: number };
};

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current || target === 0) {
      setValue(target);
      return;
    }
    started.current = true;
    const t0 = performance.now();
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function Metric({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  const n = useCountUp(value);
  return (
    <div className="flex flex-col items-center px-6 py-2">
      <span className="text-2xl md:text-3xl font-bold text-white tabular-nums">
        {new Intl.NumberFormat("en-US").format(n)}
        {suffix}
      </span>
      <span className="mt-1 text-xs uppercase tracking-wider text-gray-500">{label}</span>
    </div>
  );
}

export const LiveProofStrip = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    fetch("/api/clova/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.ok && setStats(d))
      .catch(() => {});
  }, []);

  if (!stats) return <div ref={ref} />;

  const corridors = Object.keys(stats.totals.volume.fiatByCurrency).length || 1;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: 0.5 }}
      className="mt-16 w-full max-w-3xl"
    >
      <Link
        href="/stats"
        className="group block glassmorphism rounded-2xl border border-white/5 hover:border-blue-500/20 transition-colors px-4 py-5"
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <Activity className="w-3 h-3" /> Live on-chain — verify it yourself
            <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-white/5 md:divide-x">
          <Metric label="Orders" value={stats.totals.orders} />
          <Metric label="Settlements" value={stats.totals.settlements} />
          <Metric label="Agent calls" value={stats.x402.totalCalls} />
          <Metric label="Corridors live" value={corridors} />
        </div>
      </Link>
    </motion.div>
  );
};
