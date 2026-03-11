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
    webhookUrl?: string;    // URL PayCrest POST order status events to
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
    const requestConfig = {
        method,
        url: `${config.paycrestBaseUrl}${path}`,
        headers: {
            "API-Key": config.paycrestApiKey,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        data: body,
        timeout: 15000,
        validateStatus: () => true, // Don't throw on any status code
    };

    const res = await axios(requestConfig);

    // Check HTTP status first
    if (res.status !== 200 && res.status !== 201) {
        throw new Error(`http_${res.status}: ${res.statusText} - ${JSON.stringify(res.data)}`);
    }

    // Paycrest wraps responses: { status: "success", data: { data: ... } } or { data: ... }
    const payload = res.data;
    if (payload?.status === "error" || payload?.status === false) {
        throw new Error(`paycrest_api_error: ${payload?.message || "unknown"}`);
    }
    // Unwrap nested data if present
    return payload?.data?.data ?? payload?.data ?? payload;
}

export class PaycrestProvider {
    async getExchangeRate(token: string, amount: string, currency: string, network?: string): Promise<string> {
        if (isMock()) {
            return "1450.50";
        }
        try {
            const query = network ? `?network=${network}` : "";
            const data = await paycrestRequest("GET", `/rates/${token}/${amount}/${currency}${query}`);
            return String(data);
        } catch (e: any) {
            console.error("[paycrest] getExchangeRate error:", e?.response?.data || e.message);
            throw new Error("paycrest_rate_fetch_failed");
        }
    }

    /** Fetch the live rate from PayCrest for a specific token+network combo. Returns null in mock mode. */
    async getLiveRate(token: string, amount: string, currency: string, network: string): Promise<string | null> {
        if (isMock()) return null;
        try {
            const data = await paycrestRequest("GET", `/rates/${token}/${amount}/${currency}?network=${network}`);
            const rate = String(data);
            console.log(`[paycrest] live rate for ${token}/${network}: ${rate}`);
            return rate;
        } catch (e: any) {
            console.error("[paycrest] getLiveRate error:", e?.response?.data || e.message);
            return null;
        }
    }

    async getSupportedInstitutions(currency = "NGN"): Promise<Array<{ name: string; code: string }>> {
        if (isMock()) {
            return [
                { name: "Access Bank", code: "ABNGNGLA" },
                { name: "Guaranty Trust Bank", code: "GTBINGLA" },
                { name: "United Bank for Africa", code: "UNAFNGLA" },
                { name: "Zenith Bank", code: "ZEIBNGLA" },
                { name: "First Bank Of Nigeria", code: "FBNINGLA" },
                { name: "OPay", code: "OPAYNGPC" },
                { name: "Kuda Microfinance Bank", code: "KUDANGPC" },
                { name: "PalmPay", code: "PALMNGPC" },
                { name: "Moniepoint MFB", code: "MONINGPC" },
                { name: "Wema Bank", code: "WEMANGLA" },
                { name: "Sterling Bank", code: "NAMENGLA" },
                { name: "FCMB", code: "FCMBNGLA" },
                { name: "Fidelity Bank", code: "FIDTNGLA" },
                { name: "Stanbic IBTC Bank", code: "SBICNGLA" },
                { name: "Union Bank", code: "UBNINGLA" },
                { name: "Polaris Bank", code: "PRDTNGLA" },
                { name: "Keystone Bank", code: "PLNINGLA" },
                { name: "Ecobank Bank", code: "ECOCNGLA" },
                { name: "Providus Bank", code: "PROVNGLA" },
                { name: "Safe Haven MFB", code: "SAHVNGPC" },
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
            const body: Record<string, unknown> = {
                amount: Number(input.amountCrypto),  // PayCrest expects `amount` as a number
                token: input.token,
                network: input.network,
                rate: input.rate,
                recipient: input.recipient,
                reference: input.reference,
                returnAddress: input.returnAddress,
            };
            if (input.webhookUrl) body.webhookUrl = input.webhookUrl;

            console.log("[paycrest] Creating order with payload:", JSON.stringify(body, null, 2));
            const data = await paycrestRequest("POST", "/sender/orders", body);
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
            const errorDetail = e?.response?.data || e?.data || { message: e.message };
            console.error("[paycrest] createOrder error - Full response:", JSON.stringify({
                status: e?.response?.status,
                statusText: e?.response?.statusText,
                data: errorDetail,
                headers: e?.response?.headers,
            }, null, 2));
            throw new Error(`paycrest_order_failed: ${errorDetail?.message || e.message}`);
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
