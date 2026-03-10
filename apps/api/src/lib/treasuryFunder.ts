/**
 * treasuryFunder.ts
 *
 * Background worker that automatically funds PayCrest USDC/Base deposit
 * addresses for Stacks USDCx offramp orders.
 *
 * When a Stacks order is confirmed and the settlement engine creates a
 * PayCrest USDC/Base order, this worker detects the unfunded order and
 * sends USDC from the treasury wallet to PayCrest's deposit address.
 *
 * Runs every TREASURY_FUNDER_INTERVAL_MS (default 15s).
 */

import {
    createWalletClient,
    createPublicClient,
    http,
    parseUnits,
    encodeFunctionData,
    type Hex,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.js";
import { ledger } from "./ledger.js";
import { PaycrestProvider } from "../providers/paycrest.js";

const paycrest = new PaycrestProvider();
let _timer: ReturnType<typeof setInterval> | null = null;
let _processing = false; // simple mutex to prevent overlapping runs

// ERC-20 transfer ABI fragment
const ERC20_TRANSFER_ABI = [
    {
        name: "transfer",
        type: "function",
        inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
] as const;

async function fundOrder(order: {
    orderId: string;
    amountCrypto: string;
    paycrestOrderId: string;
}) {
    const privateKey = config.treasuryPrivateKey as Hex;
    const usdcAddress = config.baseUsdcContract as Hex;

    // 1. Fetch PayCrest order to get the Base deposit address
    const pcOrder = await paycrest.getOrder(order.paycrestOrderId);
    if (!pcOrder) {
        console.error(`[treasuryFunder] ❌ PayCrest order ${order.paycrestOrderId} not found — skipping`);
        return;
    }

    const depositAddress = pcOrder.depositAddress || (pcOrder as any).receiveAddress;
    if (!depositAddress || depositAddress === "0x" || depositAddress.length < 10) {
        console.error(`[treasuryFunder] ❌ No deposit address on PayCrest order ${order.paycrestOrderId}`);
        return;
    }

    // 2. Create viem clients
    const account = privateKeyToAccount(privateKey);
    const publicClient = createPublicClient({
        chain: base,
        transport: http(config.rpcUrls.base),
    });
    const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(config.rpcUrls.base),
    });

    // 3. Parse amount (USDC has 6 decimals)
    const amount = parseUnits(order.amountCrypto, 6);

    console.log(
        `[treasuryFunder] 💸 Sending ${order.amountCrypto} USDC to ${depositAddress.slice(0, 10)}... for order ${order.orderId}`
    );

    // 4. Encode and send the ERC-20 transfer
    const data = encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [depositAddress as Hex, amount],
    });

    const txHash = await walletClient.sendTransaction({
        to: usdcAddress,
        data,
        chain: base,
    });

    console.log(`[treasuryFunder] ✅ USDC sent — txHash: ${txHash}`);

    // 5. Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        timeout: 60_000,
    });

    if (receipt.status === "reverted") {
        console.error(`[treasuryFunder] ❌ USDC transfer reverted — txHash: ${txHash}`);
        await ledger.updateOrder(order.orderId, {
            failureReason: `treasury_funding_reverted: ${txHash}`,
        });
        return;
    }

    // 6. Record the funding tx on the order
    await ledger.updateOrder(order.orderId, {
        fundingTxHash: txHash,
    });

    console.log(`[treasuryFunder] ✅ Order ${order.orderId} funded — txHash: ${txHash}`);
}

async function sweep() {
    if (_processing) return;
    _processing = true;

    try {
        const unfunded = await ledger.listUnfundedStacksOrders();
        if (unfunded.length === 0) return;

        console.log(`[treasuryFunder] found ${unfunded.length} unfunded Stacks order(s)`);

        for (const order of unfunded) {
            try {
                await fundOrder({
                    orderId: order.orderId,
                    amountCrypto: order.amountCrypto,
                    paycrestOrderId: order.paycrestOrderId!,
                });
            } catch (err: any) {
                console.error(`[treasuryFunder] ❌ funding failed for ${order.orderId}:`, err.message);
                // Don't mark as failed — will retry next sweep
            }
        }
    } catch (err: any) {
        console.error("[treasuryFunder] sweep error:", err.message);
    } finally {
        _processing = false;
    }
}

export function startTreasuryFunder() {
    const privateKey = config.treasuryPrivateKey;
    if (!privateKey) {
        console.log("[treasuryFunder] TREASURY_PRIVATE_KEY not set — funder disabled");
        return;
    }

    const reserveWallet = config.stacksReserveWallet;
    if (!reserveWallet) {
        console.log("[treasuryFunder] STACKS_RESERVE_WALLET not set — funder disabled");
        return;
    }

    if (_timer) return;

    const interval = config.treasuryFunderIntervalMs;
    console.log(`[treasuryFunder] starting — sweeping every ${interval / 1000}s, treasury: ${reserveWallet.slice(0, 10)}...`);

    // Initial sweep after a short delay (let other workers start first)
    setTimeout(sweep, 5000);
    _timer = setInterval(sweep, interval);
}

export function stopTreasuryFunder() {
    if (_timer) {
        clearInterval(_timer);
        _timer = null;
        console.log("[treasuryFunder] stopped");
    }
}
