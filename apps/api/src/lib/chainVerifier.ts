import { config } from "./config.js";

/**
 * On-chain transaction verifier.
 * Checks the actual blockchain to verify a deposit before releasing fiat.
 *
 * Verifies:
 * 1. Transaction exists and is not reverted
 * 2. It's a transfer of the correct ERC-20 token
 * 3. The recipient is our deposit wallet
 * 4. The amount matches (within tolerance)
 * 5. The tx has enough confirmations
 */

// ERC-20 Transfer(address,address,uint256) event topic
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// Token contract addresses per asset
const TOKEN_CONTRACTS: Record<string, string> = {
    cUSD_CELO: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    USDC_BASE: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

// Token decimals
const TOKEN_DECIMALS: Record<string, number> = {
    cUSD_CELO: 18,
    USDC_BASE: 6,
};

// RPC endpoints per chain
function getRpcUrl(asset: string): string {
    switch (asset) {
        case "cUSD_CELO":
            return config.rpcUrls.celo;
        case "USDC_BASE":
            return config.rpcUrls.base;
        default:
            throw new Error(`unsupported_asset: ${asset}`);
    }
}

export type VerificationResult = {
    verified: boolean;
    error?: string;
    from?: string;
    to?: string;
    tokenContract?: string;
    amountOnChain?: string;
    confirmations?: number;
    blockNumber?: number;
};

/**
 * Verify a transaction on-chain via JSON-RPC.
 */
export async function verifyDeposit(opts: {
    txHash: string;
    asset: string;
    expectedAmount: string;
    expectedRecipient: string;
    minConfirmations: number;
}): Promise<VerificationResult> {
    const rpcUrl = getRpcUrl(opts.asset);
    const expectedToken = TOKEN_CONTRACTS[opts.asset]?.toLowerCase();
    const decimals = TOKEN_DECIMALS[opts.asset];

    if (!expectedToken) {
        return { verified: false, error: `no_token_contract_for_${opts.asset}` };
    }

    try {
        // 1. Get transaction receipt
        const receipt = await rpcCall(rpcUrl, "eth_getTransactionReceipt", [opts.txHash]);
        if (!receipt) {
            return { verified: false, error: "tx_not_found_or_pending" };
        }

        // 2. Check tx was successful (status 0x1)
        if (receipt.status !== "0x1") {
            return { verified: false, error: "tx_reverted" };
        }

        // 3. Check confirmations
        const currentBlock = await rpcCall(rpcUrl, "eth_blockNumber", []);
        const txBlock = parseInt(receipt.blockNumber, 16);
        const headBlock = parseInt(currentBlock, 16);
        const confirmations = headBlock - txBlock + 1;

        if (confirmations < opts.minConfirmations) {
            return {
                verified: false,
                error: `insufficient_confirmations: ${confirmations}/${opts.minConfirmations}`,
                confirmations,
                blockNumber: txBlock,
            };
        }

        // 4. Find the ERC-20 Transfer log matching our token
        const transferLog = (receipt.logs || []).find((log: any) => {
            return (
                log.address?.toLowerCase() === expectedToken &&
                log.topics?.[0] === TRANSFER_TOPIC
            );
        });

        if (!transferLog) {
            return {
                verified: false,
                error: `no_transfer_event_for_token_${opts.asset}`,
                blockNumber: txBlock,
                confirmations,
            };
        }

        // 5. Decode Transfer event: topics[1]=from, topics[2]=to, data=amount
        const from = "0x" + transferLog.topics[1].slice(26);
        const to = "0x" + transferLog.topics[2].slice(26);
        const amountRaw = BigInt(transferLog.data);
        const amountOnChain = Number(amountRaw) / Math.pow(10, decimals);

        // 6. Verify recipient is our deposit wallet
        const expectedRecipientLower = opts.expectedRecipient.toLowerCase();
        if (to.toLowerCase() !== expectedRecipientLower) {
            return {
                verified: false,
                error: `wrong_recipient: sent to ${to}, expected ${opts.expectedRecipient}`,
                from, to, tokenContract: expectedToken,
                amountOnChain: amountOnChain.toString(),
                confirmations, blockNumber: txBlock,
            };
        }

        // 7. Verify amount (within 1% tolerance for gas/rounding)
        const expectedAmount = Number(opts.expectedAmount);
        const tolerance = expectedAmount * 0.01; // 1% tolerance
        if (amountOnChain < expectedAmount - tolerance) {
            return {
                verified: false,
                error: `amount_mismatch: on-chain=${amountOnChain}, expected=${expectedAmount}`,
                from, to, tokenContract: expectedToken,
                amountOnChain: amountOnChain.toString(),
                confirmations, blockNumber: txBlock,
            };
        }

        // ✅ All checks pass
        console.log(`[verifier] ✅ tx ${opts.txHash.substring(0, 16)}... verified: ${amountOnChain} ${opts.asset} from ${from} to ${to} (${confirmations} confirmations)`);

        return {
            verified: true,
            from,
            to,
            tokenContract: expectedToken,
            amountOnChain: amountOnChain.toString(),
            confirmations,
            blockNumber: txBlock,
        };

    } catch (err: any) {
        console.error(`[verifier] RPC error:`, err.message);
        return { verified: false, error: `rpc_error: ${err.message}` };
    }
}

/**
 * JSON-RPC helper
 */
async function rpcCall(rpcUrl: string, method: string, params: any[]): Promise<any> {
    const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`rpc_http_${res.status}`);
    const data: any = await res.json();
    if (data.error) throw new Error(`rpc_error: ${data.error.message}`);
    return data.result;
}
