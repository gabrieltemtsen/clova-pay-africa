/**
 * Client-side order history, keyed to this device via localStorage.
 * No accounts needed — orders created in this browser are remembered here,
 * and their live status is re-fetched from the API by <OrderHistory />.
 */

export type StoredOrder = {
  orderId: string;
  direction: "offramp" | "onramp";
  asset: string;
  amountCrypto: string;
  destinationCurrency: string;
  receiveFiat?: string;
  status: string;
  txHash?: string;
  createdAt: number;
};

const KEY = "clova.order-history.v1";
const MAX_ORDERS = 50;

export const FINAL_STATUSES = new Set(["settled", "paid_out", "completed", "paid", "failed", "expired", "refunded"]);

export function listStoredOrders(): StoredOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(orders: StoredOrder[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(orders.slice(0, MAX_ORDERS)));
    window.dispatchEvent(new CustomEvent("clova:orders-changed"));
  } catch {
    /* storage full / private mode — history is best-effort */
  }
}

export function saveStoredOrder(order: StoredOrder) {
  if (typeof window === "undefined") return;
  const orders = listStoredOrders().filter((o) => o.orderId !== order.orderId);
  orders.unshift(order);
  persist(orders);
}

export function patchStoredOrder(orderId: string, patch: Partial<StoredOrder>) {
  if (typeof window === "undefined") return;
  const orders = listStoredOrders();
  const idx = orders.findIndex((o) => o.orderId === orderId);
  if (idx === -1) return;
  orders[idx] = { ...orders[idx], ...patch };
  persist(orders);
}
