import { Router } from "express";
import { ledger } from "../lib/ledger.js";

export const statsRouter = Router();

type Asset = string;

function explorerTxUrl(asset: string, txHash: string): string {
  const hash = txHash.startsWith("0x") ? txHash : txHash;
  if (asset.includes("BASE")) return `https://basescan.org/tx/${hash}`;
  if (asset.includes("CELO")) return `https://celoscan.io/tx/${hash}`;
  if (asset.includes("ARBITRUM")) return `https://arbiscan.io/tx/${hash}`;
  if (asset.includes("POLYGON")) return `https://polygonscan.com/tx/${hash}`;
  if (asset.includes("ETHEREUM")) return `https://etherscan.io/tx/${hash}`;
  if (asset.includes("BSC")) return `https://bscscan.com/tx/${hash}`;
  if (asset.includes("SCROLL")) return `https://scrollscan.com/tx/${hash}`;
  if (asset.includes("LISK")) return `https://blockscout.lisk.com/tx/${hash}`;
  if (asset.includes("STACKS")) return `https://explorer.hiro.so/txid/${hash}?chain=mainnet`;
  return "";
}

function shortAddr(a?: string): string | null {
  if (!a) return null;
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

statsRouter.get("/v1/stats", async (_req, res) => {
  const [orders, settlements, payouts, x402Events] = await Promise.all([
    ledger.listOrders(2000),
    ledger.listSettlements(2000),
    ledger.listPayouts(),
    ledger.listX402Events(2000),
  ]);

  const totals = {
    orders: orders.length,
    settlements: settlements.length,
    payouts: payouts.length,
    byStatus: {
      awaiting_deposit: 0,
      confirming: 0,
      paid_out: 0,
      settled: 0,
      failed: 0,
      expired: 0,
    } as Record<string, number>,
    byAsset: {} as Record<Asset, number>,
    volume: {
      crypto: {} as Record<Asset, number>,
      fiat: 0,
      fiatByCurrency: {} as Record<string, number>,
    },
  };

  for (const o of orders) {
    totals.byStatus[o.status] = (totals.byStatus[o.status] || 0) + 1;
    totals.byAsset[o.asset as Asset] = (totals.byAsset[o.asset as Asset] || 0) + 1;

    const amt = Number(o.amountCrypto || 0);
    if (!Number.isNaN(amt)) {
      totals.volume.crypto[o.asset as Asset] = (totals.volume.crypto[o.asset as Asset] || 0) + amt;
    }

    const fiat = Number((o as any).receiveFiat || 0);
    const currency = (o as any).destinationCurrency || "NGN";
    if (!Number.isNaN(fiat)) {
      totals.volume.fiat += fiat;
      totals.volume.fiatByCurrency[currency] = (totals.volume.fiatByCurrency[currency] || 0) + fiat;
    }
  }

  // ── x402 agent/developer usage ──
  const cutoff30d = Date.now() - 30 * DAY_MS;
  const payers = new Set<string>();
  const payers30d = new Set<string>();
  const byEndpoint = {} as Record<string, number>;
  let calls30d = 0;

  for (const e of x402Events) {
    if (e.payer) payers.add(e.payer.toLowerCase());
    byEndpoint[e.endpoint] = (byEndpoint[e.endpoint] || 0) + 1;
    if (e.createdAt >= cutoff30d) {
      calls30d += 1;
      if (e.payer) payers30d.add(e.payer.toLowerCase());
    }
  }

  const x402 = {
    totalCalls: x402Events.length,
    calls30d,
    distinctPayers: payers.size,
    distinctPayers30d: payers30d.size,
    byEndpoint,
    lastEvents: x402Events.slice(0, 20).map((e) => ({
      endpoint: e.endpoint,
      method: e.method,
      payer: shortAddr(e.payer),
      network: e.network,
      price: e.price,
      createdAt: e.createdAt,
    })),
  };

  // ── 30-day daily activity series (orders + x402 calls) ──
  const series: { date: string; orders: number; x402Calls: number }[] = [];
  const seriesIndex = new Map<string, { date: string; orders: number; x402Calls: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = dayKey(Date.now() - i * DAY_MS);
    const row = { date: d, orders: 0, x402Calls: 0 };
    series.push(row);
    seriesIndex.set(d, row);
  }
  for (const o of orders) {
    const row = seriesIndex.get(dayKey(o.createdAt));
    if (row) row.orders += 1;
  }
  for (const e of x402Events) {
    const row = seriesIndex.get(dayKey(e.createdAt));
    if (row) row.x402Calls += 1;
  }

  const lastTxs = settlements
    .slice(0, 25)
    .map((s) => ({
      asset: s.asset,
      txHash: s.txHash,
      explorerUrl: explorerTxUrl(s.asset as Asset, s.txHash),
      quoteId: s.quoteId,
      amountCrypto: s.amountCrypto,
      createdAt: s.createdAt,
    }));

  return res.json({
    ok: true,
    generatedAt: Date.now(),
    totals,
    x402,
    series,
    lastTxs,
    lastOrders: orders.slice(0, 20).map((o) => ({
      orderId: o.orderId,
      asset: o.asset,
      amountCrypto: o.amountCrypto,
      destinationCurrency: (o as any).destinationCurrency || "NGN",
      status: o.status,
      txHash: o.txHash || null,
      txExplorerUrl: o.txHash ? explorerTxUrl(o.asset as Asset, o.txHash) : null,
      createdAt: o.createdAt,
    })),
  });
});
