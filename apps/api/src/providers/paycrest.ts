import axios from "axios";
import { createHmac } from "node:crypto";
import { config } from "../lib/config.js";

export type PaycrestOrderInput = {
    amountCrypto: string;
    token: string;          // "USDC" | "CUSD"
    network: string;        // "base" | "celo"
    rate: string;
    recipient: {
        institution: string;        // bank code e.g. "058"
        accountIdentifier: string;  // account number
        accountName: string;
        currency: string;           // "NGN"
        memo?: string;
    };
    reference: string;
    returnAddress: string;  // refund address if order fails
};

export type PaycrestOrderResponse = {
    id: string;
    status: string;
    reference: string;
    depositAddress: string;
    amountCrypto: string;
    token: string;
    network: string;
    rate: string;
    recipient: PaycrestOrderInput["recipient"];
    returnAddress: string;
    createdAt?: string;
};

function isMock(): boolean {
    return config.paycrestMode !== "live";
}

async function paycrestRequest(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
): Promise<any> {
    const res = await axios({
        method,
        url: `${config.paycrestBaseUrl}${path}`,
        headers: {
            "API-Key": config.paycrestApiKey,
            "Content-Type": "application/json",
        },
        data: body,
        timeout: 15000,
    });

    // Paycrest wraps responses: { status: "success", data: { data: ... } } or { data: ... }
    const payload = res.data;
    if (payload?.status === "error" || payload?.status === false) {
        throw new Error(`paycrest_api_error: ${payload?.message || "unknown"}`);
    }
    // Unwrap nested data if present
    return payload?.data?.data ?? payload?.data ?? payload;
}

export class PaycrestProvider {
    async getExchangeRate(token: string, amount: string, currency: string): Promise<string> {
        if (isMock()) {
            return "1450.50";
        }
        try {
            const data = await paycrestRequest("GET", `/rates/${token}/${amount}/${currency}`);
            return String(data);
        } catch (e: any) {
            console.error("[paycrest] getExchangeRate error:", e?.response?.data || e.message);
            throw new Error("paycrest_rate_fetch_failed");
        }
    }

    async getSupportedInstitutions(currency = "NGN"): Promise<Array<{ name: string; code: string }>> {
        if (isMock()) {
            return [
                { name: "Access Bank", code: "044" },
                { name: "Guaranty Trust Bank", code: "058" },
                { name: "United Bank For Africa", code: "033" },
                { name: "Zenith Bank", code: "057" },
                { name: "First Bank of Nigeria", code: "011" },
            ];
        }
        try {
            const data = await paycrestRequest("GET", `/institutions/${currency}`);
            const rows = Array.isArray(data) ? data : [];
            return rows.map((r: any) => ({
                name: String(r?.name || r?.institution || ""),
                code: String(r?.code || r?.institutionCode || ""),
            })).filter((r) => r.name && r.code);
        } catch (e: any) {
            console.error("[paycrest] getSupportedInstitutions error:", e.message);
            return [];
        }
    }

    async createOrder(input: PaycrestOrderInput): Promise<PaycrestOrderResponse> {
        if (isMock()) {
            return {
                id: `pc_mock_${Date.now()}`,
                status: "pending",
                reference: input.reference,
                depositAddress: input.returnAddress || "0xMockDepositAddress",
                amountCrypto: input.amountCrypto,
                token: input.token,
                network: input.network,
                rate: input.rate,
                recipient: input.recipient,
                returnAddress: input.returnAddress,
            };
        }
        try {
            const data = await paycrestRequest("POST", "/sender/orders", input);
            return {
                id: String(data?.id || data?.orderId || ""),
                status: String(data?.status || "pending"),
                reference: String(data?.reference || input.reference),
                depositAddress: String(data?.depositAddress || data?.receiveAddress || ""),
                amountCrypto: String(data?.amount || input.amountCrypto),
                token: String(data?.token || input.token),
                network: String(data?.network || input.network),
                rate: String(data?.rate || input.rate),
                recipient: data?.recipient || input.recipient,
                returnAddress: String(data?.returnAddress || input.returnAddress),
                createdAt: data?.createdAt,
            };
        } catch (e: any) {
            console.error("[paycrest] createOrder error:", e?.response?.data || e.message);
            throw new Error(`paycrest_order_failed: ${e?.response?.data?.message || e.message}`);
        }
    }

    async getOrder(paycrestOrderId: string): Promise<PaycrestOrderResponse | null> {
        if (isMock()) {
            return null;
        }
        try {
            const data = await paycrestRequest("GET", `/sender/orders/${paycrestOrderId}`);
            return data as PaycrestOrderResponse;
        } catch (e: any) {
            console.error("[paycrest] getOrder error:", e.message);
            return null;
        }
    }

    verifyWebhook(rawBody: string, signature?: string): boolean {
        if (isMock()) return true;

        const secret = config.paycrestWebhookSecret || config.paycrestApiKey;
        if (!signature || !secret) return false;

        try {
            const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
            return expected === signature;
        } catch {
            return false;
        }
    }
}
