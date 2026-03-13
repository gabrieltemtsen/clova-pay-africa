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
        // Always fetch live from Paycrest — institution list is public, no auth required.
        // In mock mode we still call the live API so institution codes are always accurate.
        try {
            const data = await paycrestRequest("GET", `/institutions/${currency}`);
            const rows = Array.isArray(data) ? data : [];
            const mapped = rows.map((r: any) => ({
                name: String(r?.name || r?.institution || ""),
                code: String(r?.code || r?.institutionCode || ""),
            })).filter((r) => r.name && r.code);
            if (mapped.length > 0) return mapped;
        } catch (e: any) {
            console.warn("[paycrest] getSupportedInstitutions live fetch failed, using static fallback:", e.message);
        }
        // Static fallback — only used if Paycrest API is unreachable
        // NOTE: these are the verified Paycrest institution codes as of 2026-03-13
        const fallback: Record<string, Array<{ name: string; code: string }>> = {
            NGN: [
                { name: "Access Bank", code: "ABNGNGLA" },
                { name: "Guaranty Trust Bank", code: "GTBINGLA" },
                { name: "United Bank for Africa", code: "UNAFNGLA" },
                { name: "Zenith Bank", code: "ZEIBNGLA" },
                { name: "First Bank Of Nigeria", code: "FBNINGLA" },
                { name: "Fidelity Bank", code: "FIDTNGLA" },
                { name: "FCMB", code: "FCMBNGLA" },
                { name: "Wema Bank", code: "WEMANGLA" },
                { name: "Sterling Bank", code: "NAMENGLA" },
                { name: "Stanbic IBTC Bank", code: "SBICNGLA" },
                { name: "Union Bank", code: "UBNINGLA" },
                { name: "Polaris Bank", code: "PRDTNGLA" },
                { name: "Keystone Bank", code: "PLNINGLA" },
                { name: "Ecobank Bank", code: "ECOCNGLA" },
                { name: "Providus Bank", code: "PROVNGLA" },
                { name: "Jaiz Bank", code: "JAIZNGLA" },
                { name: "OPay", code: "OPAYNGPC" },
                { name: "Kuda Microfinance Bank", code: "KUDANGPC" },
                { name: "PalmPay", code: "PALMNGPC" },
                { name: "Moniepoint MFB", code: "MONINGPC" },
                { name: "Safe Haven MFB", code: "SAHVNGPC" },
            ],
            KES: [
                { name: "M-PESA", code: "SAFAKEPC" },
                { name: "AIRTEL", code: "AIRTKEPC" },
                { name: "Equity Bank", code: "EQBLKENA" },
                { name: "Kenya Commercial Bank", code: "KCBLKENX" },
                { name: "Cooperative Bank of Kenya", code: "KCOOKENA" },
                { name: "ABSA Bank Kenya", code: "BARCKENX" },
                { name: "Standard Chartered Kenya", code: "SCBLKENX" },
                { name: "Stanbic Bank Kenya", code: "SBICKENX" },
                { name: "National Bank of Kenya", code: "NBKEKENX" },
                { name: "Family Bank", code: "FABLKENA" },
                { name: "Guaranty Trust Holding Company PLC", code: "GTBIKENA" },
            ],
            GHS: [
                { name: "MTN Mobile Money", code: "MOMOGHPC" },
                { name: "Vodafone Cash", code: "VODAGHPC" },
                { name: "AirtelTigo Money", code: "AIRTGHPC" },
                { name: "GCB Bank Limited", code: "GHCBGHAC" },
                { name: "Ecobank Ghana", code: "ECOCGHAC" },
                { name: "ABSA Bank Ghana", code: "BARCGHAC" },
                { name: "Stanbic Bank Ghana", code: "SBICGHAC" },
                { name: "Access Bank Ghana", code: "ABNGGHAC" },
                { name: "Zenith Bank Ghana", code: "ZEBLGHAC" },
                { name: "GT Bank Ghana", code: "GTBIGHAC" },
            ],
            UGX: [
                { name: "MTN Mobile Money", code: "MOMOUGPC" },
                { name: "Airtel Money", code: "AIRTUGPC" },
            ],
            TZS: [
                { name: "Tigo Pesa", code: "TIGOTZPC" },
                { name: "Airtel Money", code: "AIRTTZPC" },
                { name: "Halopesa", code: "HALOTZPC" },
                { name: "CRDB Bank PLC", code: "CORUTZTZ" },
                { name: "National Microfinance Bank Ltd.", code: "NMIBTZTZ" },
                { name: "Equity Bank Tanzania Limited", code: "EQBLTZTZ" },
                { name: "KCB Bank Tanzania Ltd", code: "KCBLTZTZ" },
            ],
            MWK: [
                { name: "TNM Mpamba", code: "TNMPMWPC" },
                { name: "National Bank of Malawi", code: "NBMAMWMW" },
                { name: "Standard Bank Limited", code: "SBICMWMX" },
                { name: "FDH Bank Limited", code: "FDHFMWMW" },
                { name: "Ecobank Malawi Limited", code: "ECOCMWMW" },
            ],
            BRL: [
                { name: "Pix", code: "PIXKBRPC" },
                { name: "PixQR", code: "PIXQBRPC" },
            ],
        };
        return fallback[currency.toUpperCase()] || [];
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
