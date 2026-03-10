/**
 * stacksWatcher.ts
 *
 * Background worker that polls the Hiro Stacks API for incoming USDCx
 * transfers to our deposit wallet. When a deposit is found, it feeds
 * the data into the settlement engine via `processCredited()`.
 *
 * Runs every STACKS_WATCHER_INTERVAL_MS (default 30s).
 */

import { config } from "./config.js";
import { ledger } from "./ledger.js";
import { processCredited } from "./settlementEngine.js";

const USDCX_CONTRACT = (
    process.env.USDCX_STACKS_CONTRACT ||
    "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.usdc"
).toLowerCase();

let _timer: ReturnType<typeof setInterval> | null = null;
let _lastSeenTxId: string | null = null; // Track last processed tx to avoid duplicates

/**
 * Decode a hex-encoded memo string.
 * Stacks memos are often hex-encoded UTF-8 strings.
 */
function decodeMemo(hexOrRaw: string): string {
    if (!hexOrRaw) return "";
    // If it starts with 0x, decode hex
    if (hexOrRaw.startsWith("0x")) {
        try {
            const bytes = Buffer.from(hexOrRaw.slice(2), "hex");
            return bytes.toString("utf8").replace(/\0/g, "").trim();
        } catch {
            return hexOrRaw;
        }
    }
    return hexOrRaw.trim();
}

/**
 * Extract orderId from transaction memo or post-conditions.
 * Users include their orderId in the memo field when calling the deposit function.
 */
function extractOrderId(tx: any): string | null {
    // 1. Check contract call function args for a memo argument
    if (tx.contract_call?.function_args) {
        for (const arg of tx.contract_call.function_args) {
            if (
                arg.name === "memo" &&
                arg.repr &&
                typeof arg.repr === "string"
            ) {
                // Clarity repr: 0x... or "ord_xxx"
                const decoded = decodeMemo(arg.repr.replace(/^"|"$/g, ""));
                if (decoded.startsWith("ord_")) return decoded;
            }
        }
    }

    // 2. Check top-level tx memo
    if (tx.token_transfer?.memo) {
        const decoded = decodeMemo(tx.token_transfer.memo);
        if (decoded.startsWith("ord_")) return decoded;
    }

    // 3. Check post conditions for a memo
    if (tx.post_conditions) {
        for (const pc of tx.post_conditions) {
            if (pc.condition_code === "sent_equal_to" || pc.condition_code === "sent_greater_than_or_equal_to") {
                // Some implementations pass orderId through nonce or metadata
            }
        }
    }

    return null;
}

async function poll() {
    const depositWallet = config.depositWallets.USDCX_STACKS;
    if (!depositWallet) return;

    const apiBase = config.rpcUrls.stacks;

    try {
        // Fetch recent transactions for the deposit wallet
        const url = `${apiBase}/extended/v1/address/${depositWallet}/transactions?limit=20`;
        const res = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
            console.error(`[stacksWatcher] Hiro API HTTP ${res.status}`);
            return;
        }

        const data: any = await res.json();
        const results: any[] = data?.results || [];

        if (results.length === 0) return;

        // If first run, just record the latest tx to avoid processing history
        if (_lastSeenTxId === null) {
            _lastSeenTxId = results[0]?.tx_id || null;
            console.log(`[stacksWatcher] initialized — last seen tx: ${_lastSeenTxId?.slice(0, 16)}...`);
            return;
        }

        // Process new transactions (stop at the last seen one)
        const newTxs: any[] = [];
        for (const tx of results) {
            if (tx.tx_id === _lastSeenTxId) break;
            newTxs.push(tx);
        }

        if (newTxs.length === 0) return;

        // Update last seen to newest
        _lastSeenTxId = results[0]?.tx_id || _lastSeenTxId;

        for (const tx of newTxs) {
            // Only process successful transactions
            if (tx.tx_status !== "success") continue;

            // Look for USDCx fungible token transfer events to our wallet
            const events: any[] = tx.events || [];
            const usdcxTransfer = events.find((e: any) => {
                if (e.event_type !== "fungible_token_asset") return false;
                const asset = e.asset || {};
                if (asset.asset_event_type !== "transfer") return false;
                const assetId = String(asset.asset_id || "").toLowerCase();
                const contractPart = USDCX_CONTRACT.split("::")[0];
                if (!assetId.startsWith(contractPart)) return false;
                // Recipient must be our deposit wallet
                const recipient = String(asset.recipient || "").toLowerCase();
                return recipient === depositWallet.toLowerCase();
            });

            if (!usdcxTransfer) continue;

            // Extract amount (USDCx has 6 decimals)
            const amountRaw = Number(usdcxTransfer.asset?.amount || 0);
            const amountCrypto = (amountRaw / 1e6).toString();

            // Extract orderId from memo
            const orderId = extractOrderId(tx);

            if (!orderId) {
                console.warn(`[stacksWatcher] USDCx deposit found (${amountCrypto}) but no orderId in memo — tx: ${tx.tx_id.slice(0, 16)}...`);
                continue;
            }

            // Check if this tx was already processed (idempotent)
            const existingSettlement = await ledger.findSettlementByTxHash(tx.tx_id);
            if (existingSettlement) {
                console.log(`[stacksWatcher] tx ${tx.tx_id.slice(0, 16)}... already processed — skipping`);
                continue;
            }

            console.log(`[stacksWatcher] 🔔 USDCx deposit detected: ${amountCrypto} USDCx, orderId=${orderId}, tx=${tx.tx_id.slice(0, 16)}...`);

            // Feed into settlement engine
            try {
                const result = await processCredited({
                    orderId,
                    asset: "USDCX_STACKS",
                    amountCrypto,
                    txHash: tx.tx_id,
                    confirmations: 1,
                    source: "watcher",
                });
                console.log(`[stacksWatcher] ✅ processCredited result:`, JSON.stringify(result));
            } catch (err: any) {
                console.error(`[stacksWatcher] ❌ processCredited failed for ${orderId}:`, err.message);
            }
        }
    } catch (err: any) {
        console.error("[stacksWatcher] poll error:", err.message);
    }
}

export function startStacksWatcher() {
    const depositWallet = config.depositWallets.USDCX_STACKS;
    if (!depositWallet) {
        console.log("[stacksWatcher] DEPOSIT_WALLET_STACKS not set — watcher disabled");
        return;
    }

    if (_timer) return; // already running

    const interval = config.stacksWatcherIntervalMs;
    console.log(`[stacksWatcher] starting — polling ${depositWallet.slice(0, 20)}... every ${interval / 1000}s`);

    // Initial poll
    poll();
    _timer = setInterval(poll, interval);
}

export function stopStacksWatcher() {
    if (_timer) {
        clearInterval(_timer);
        _timer = null;
        console.log("[stacksWatcher] stopped");
    }
}
