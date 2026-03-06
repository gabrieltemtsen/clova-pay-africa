/**
 * expiryWorker.ts
 *
 * Background job that sweeps for stale `awaiting_deposit` orders and marks
 * them `expired`. Runs every CHECK_INTERVAL_MS (default 5 minutes).
 *
 * Safe to run against both MemoryLedger and PostgresLedger.
 */

import { ledger } from "./ledger.js";

const CHECK_INTERVAL_MS = Number(process.env.EXPIRY_CHECK_INTERVAL_MS || 5 * 60 * 1000);

let _timer: ReturnType<typeof setInterval> | null = null;

async function sweep() {
  const now = Date.now();
  try {
    const stale = await ledger.listStaleAwaitingOrders(now);
    if (stale.length === 0) return;

    console.log(`[expiryWorker] expiring ${stale.length} stale order(s)`);
    await Promise.all(
      stale.map((order) =>
        ledger.updateOrder(order.orderId, {
          status: "expired",
          failureReason: "order_expired_no_deposit_received",
        }),
      ),
    );
    console.log(`[expiryWorker] ✅ expired ${stale.length} order(s)`);
  } catch (err: any) {
    console.error("[expiryWorker] sweep error:", err.message);
  }
}

export function startExpiryWorker() {
  if (_timer) return; // already running
  console.log(`[expiryWorker] starting — sweep every ${CHECK_INTERVAL_MS / 1000}s`);
  // Run once on startup, then on interval
  sweep();
  _timer = setInterval(sweep, CHECK_INTERVAL_MS);
}

export function stopExpiryWorker() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}
