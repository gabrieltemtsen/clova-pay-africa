import "dotenv/config";
import { createThirdwebClient } from "thirdweb";
import { privateKeyToAccount, createWallet } from "thirdweb/wallets";
import { celo, celoSepoliaTestnet, base } from "thirdweb/chains";
import { wrapFetchWithPayment } from "thirdweb/x402";

// Configure network based on env
const networkName = (process.env.X402_NETWORK || "celo").toLowerCase();
const network =
    networkName === "celo-sepolia"
        ? celoSepoliaTestnet
        : networkName === "base"
            ? base
            : celo;

const API_URL = "http://localhost:3000";

async function run() {
    console.log("=== Testing x402 Payment Middleware ===");
    console.log(`Targeting API: ${API_URL}`);
    console.log(`Expected Network: ${networkName}`);

    // Test 1: Hit a paid endpoint WITHOUT API key or Payment Header
    console.log("\n[Test 1] Requesting without payment...");

    const quoteBody = {
        amountCrypto: "1",
        asset: "cUSD_CELO",
        destinationCurrency: "NGN",
    };

    const res1 = await fetch(`${API_URL}/v1/quotes`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(quoteBody),
    });

    const body1 = await res1.json();

    if (res1.status === 402) {
        console.log("✅ API successfully denied access and requested payment (402).");
        console.log("Response Body:", body1);

        const paymentRequest = res1.headers.get("payment-required") || res1.headers.get("x-payment-request");
        if (paymentRequest) {
            console.log(`✅ Received payment-required header: ${paymentRequest.substring(0, 50)}...`);
        } else {
            console.error("❌ Missing payment-required header!");
            console.log("Headers received:", [...res1.headers.entries()]);
        }
    } else if (res1.status === 503 && body1.error === "x402_not_configured") {
        console.error("❌ API x402 is NOT configured. Ensure THIRDWEB_SECRET_KEY and X402_SERVER_WALLET are set in .env.");
        process.exit(1);
    } else {
        console.error(`❌ Unexpected response status: ${res1.status} - ${JSON.stringify(body1)}`);
        console.log("Is the API server running? Start it with 'pnpm dev' in apps/api.");
        process.exit(1);
    }

    // Test 2: Attempting client payment
    console.log("\n[Test 2] Attempting x402 client flow...");

    const clientKey = process.env.TEST_CLIENT_PRIVATE_KEY;
    const clientId = process.env.THIRDWEB_CLIENT_ID || process.env.THIRDWEB_SECRET_KEY;

    if (!clientKey || !clientId) {
        console.log("⚠️ Skipping actual payment. To test full flow, provide TEST_CLIENT_PRIVATE_KEY and THIRDWEB_CLIENT_ID / THIRDWEB_SECRET_KEY in your .env.");
        return;
    }

    console.log("🔌 Initializing Thirdweb client and wallet...");
    const client = createThirdwebClient({ secretKey: clientId });
    const account = privateKeyToAccount({ client, privateKey: clientKey });
    const wallet: any = {
        id: "private-key",
        getAccount: () => account,
        getChain: () => network,
        switchChain: async () => { },
    };

    console.log(`Wallet Address: ${account.address}`);
    console.log("💸 Simulating full x402 request via 'wrapFetchWithPayment'...");

    try {
        const fetchWithPay = wrapFetchWithPayment(fetch, client, wallet);
        const paidRes = await fetchWithPay(`${API_URL}/v1/quotes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(quoteBody),
        });

        const paidBody = await paidRes.json();
        if (paidRes.ok) {
            console.log("✅ Auto-payment successful! Received 200 OK.");
            console.log("API Response:", paidBody);

            const receipt = paidRes.headers.get("x-payment-receipt-id");
            if (receipt) console.log(`🧾 Receipt ID: ${receipt}`);
        } else {
            console.error(`❌ Payment failed or API returned error: ${paidRes.status}`, paidBody);
        }
    } catch (err: any) {
        console.error("❌ Exception during payment flow:", err.message);
    }
}

run().catch(console.error);
