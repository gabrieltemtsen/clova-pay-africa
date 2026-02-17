export type PaystackTransferInput = {
  amountKobo: number;
  recipientCode: string;
  reason?: string;
};

export class PaystackProvider {
  async createTransfer(input: PaystackTransferInput) {
    // Stub for MVP scaffold. Next PR will wire real API call.
    return {
      provider: "paystack",
      status: "queued",
      transferRef: `pst_${Date.now()}`,
      ...input,
    };
  }
}
