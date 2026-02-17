import { createHmac } from "node:crypto";
import { config } from "../lib/config.js";

export type PaystackTransferInput = {
  amountKobo: number;
  recipientCode: string;
  reason?: string;
};

export type PaystackRecipientInput = {
  name: string;
  accountNumber: string;
  bankCode: string;
  currency?: "NGN";
};

async function paystackRequest(path: string, method: "GET" | "POST", body?: unknown) {
  const r = await fetch(`${config.paystackBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.paystackSecretKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await r.json();
  if (!r.ok || data?.status === false) {
    throw new Error(`paystack_http_${r.status}:${data?.message || "request_failed"}`);
  }
  return data;
}

export class PaystackProvider {
  async listBanks(country = "nigeria"): Promise<Array<{ name: string; code: string }>> {
    if (config.paystackMode !== "live") {
      return [
        { name: "Access Bank", code: "044" },
        { name: "Guaranty Trust Bank", code: "058" },
        { name: "United Bank For Africa", code: "033" },
        { name: "Zenith Bank", code: "057" },
        { name: "First Bank of Nigeria", code: "011" },
      ];
    }

    const data = await paystackRequest(`/bank?country=${encodeURIComponent(country)}`, "GET");
    const rows = Array.isArray(data?.data) ? data.data : [];
    return rows
      .map((r: any) => ({ name: String(r?.name || ""), code: String(r?.code || "") }))
      .filter((r: { name: string; code: string }) => r.name && r.code);
  }
  async createRecipient(input: PaystackRecipientInput): Promise<{ recipientCode: string }> {
    if (config.paystackMode !== "live") {
      return { recipientCode: `RCP_mock_${Date.now()}` };
    }

    const data = await paystackRequest("/transferrecipient", "POST", {
      type: "nuban",
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: input.currency || "NGN",
    });

    return { recipientCode: data.data.recipient_code };
  }

  async createTransfer(input: PaystackTransferInput) {
    if (config.paystackMode !== "live") {
      return {
        provider: "paystack",
        status: "queued",
        transferCode: `TRF_mock_${Date.now()}`,
        transferRef: `clova_${Date.now()}`,
        ...input,
      };
    }

    const transferRef = `clova_${Date.now()}`;
    const data = await paystackRequest("/transfer", "POST", {
      source: "balance",
      amount: input.amountKobo,
      recipient: input.recipientCode,
      reason: input.reason,
      reference: transferRef,
    });

    return {
      provider: "paystack",
      status: data.data.status,
      transferCode: data.data.transfer_code,
      transferRef: data.data.reference || transferRef,
      ...input,
    };
  }

  verifyWebhook(rawBody: string, signature?: string): boolean {
    if (config.paystackMode !== "live") return true;
    if (!signature || !config.paystackWebhookSecret) return false;
    const expected = createHmac("sha512", config.paystackWebhookSecret).update(rawBody).digest("hex");
    return expected === signature;
  }
}
