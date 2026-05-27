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

statsRouter.get("/v1/stats", async (_req, res) => {
  const [orders, settlements, payouts] = await Promise.all([
    ledger.listOrders(2000),
    ledger.listSettlements(2000),
    ledger.listPayouts(),
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
    },
  };

  for (const o of orders) {
    totals.byStatus[o.status] = (totals.byStatus[o.status] || 0) + 1;
    totals.byAsset[o.asset as Asset] = (totals.byAsset[o.asset as Asset] || 0) + 1;

    const amt = Number(o.amountCrypto || 0);
    if (!Number.isNaN(amt)) {
      totals.volume.crypto[o.asset as Asset] += amt;
    }

    const fiat = Number((o as any).receiveFiat || 0);
    if (!Number.isNaN(fiat)) totals.volume.fiat += fiat;
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
    totals,
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
