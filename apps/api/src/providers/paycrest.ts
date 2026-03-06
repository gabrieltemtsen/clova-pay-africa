import axios from "axios";
import { createHmac } from "node:crypto";
import { config } from "../lib/config.js";

export type PaycrestOrderInput = {
    amountCrypto: string;
    token: string;
    network: string;
    rate: string;
    recipient: {
        institution: string;     // bank code
        accountIdentifier: string; // account number
        accountName: string;
        currency: string;
        memo?: string;
    };
    reference: string;
    returnAddress: string;
};

export class PaycrestProvider {
    private apiKey: string;
    private baseUrl: string;

    constructor() {
        this.apiKey = process.env.PAYCREST_API_KEY || "";
        this.baseUrl = "https://api.paycrest.io/v1";
    }

    async getExchangeRate(token: string, amount: string, currency: string): Promise<string> {
        if (config.paystackMode !== "live") {
            // Mock local testing rate
            return "1450.50";
        }

        try {
            const response = await axios.get(
                `${this.baseUrl}/rates/${token}/${amount}/${currency}`,
                { headers: { "API-Key": this.apiKey } }
            );
            // The API returns { data: { data: "1450.50" } }
            return String(response.data.data.data);
        } catch (e: any) {
            console.error("[paycrest] Error getting exchange rate:", e?.response?.data || e.message);
            throw new Error("paycrest_rate_fetch_failed");
        }
    }

    async createOrder(input: PaycrestOrderInput) {
        if (config.paystackMode !== "live") {
            // Mock order
            return {
                ...input,
                id: `pc_mock_${Date.now()}`,
                status: "pending",
                reference: input.reference,
                depositAddress: input.returnAddress, // simulated
            };
        }

        try {
            const response = await axios.post(
                `${this.baseUrl}/sender/orders`,
                input,
                {
                    headers: {
                        "API-Key": this.apiKey,
                        "Content-Type": "application/json",
                    },
                }
            );

            return response.data;
        } catch (e: any) {
            console.error("[paycrest] Error creating order:", e?.response?.data || e.message);
            throw new Error(`paycrest_order_failed: ${e?.response?.data?.message || e.message}`);
        }
    }

    verifyWebhook(rawBody: string, signature?: string): boolean {
        if (config.paystackMode !== "live") return true; // Accept mocks in dev

        // Fallback: If no dedicated webhook secret provided, use api key or standard validation.
        // Ensure you set PAYCREST_WEBHOOK_SECRET in production.
        const secret = process.env.PAYCREST_WEBHOOK_SECRET || this.apiKey;
        if (!signature || !secret) return false;

        try {
            const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
            return expected === signature;
        } catch (e) {
            return false;
        }
    }
}
