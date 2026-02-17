export type PayoutRecord = {
  payoutId: string;
  quoteId: string;
  amountKobo: number;
  currency: "NGN";
  recipientCode: string;
  reason?: string;
  status: "processing" | "settled" | "failed";
  provider: "paystack";
  transferCode?: string;
  transferRef?: string;
  failureReason?: string;
  createdAt: number;
  updatedAt: number;
};

const payouts = new Map<string, PayoutRecord>();

export const store = {
  putPayout(p: PayoutRecord) {
    payouts.set(p.payoutId, p);
  },
  getPayout(payoutId: string) {
    return payouts.get(payoutId);
  },
  updatePayout(payoutId: string, patch: Partial<PayoutRecord>) {
    const p = payouts.get(payoutId);
    if (!p) return undefined;
    const next = { ...p, ...patch, updatedAt: Date.now() };
    payouts.set(payoutId, next);
    return next;
  },
  findPayoutByTransferRef(transferRef: string) {
    return Array.from(payouts.values()).find((p) => p.transferRef === transferRef || p.transferCode === transferRef);
  },
  listPayouts() {
    return Array.from(payouts.values()).sort((a, b) => b.createdAt - a.createdAt);
  }
};
