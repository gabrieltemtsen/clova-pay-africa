export const config = {
  port: Number(process.env.PORT || 8787),
  defaultFeeBps: Number(process.env.DEFAULT_FEE_BPS || 150),
  defaultNgnRate: Number(process.env.DEFAULT_NGN_RATE || 1500),
  rateMarginPct: Number(process.env.RATE_MARGIN_PCT || 3), // FX spread profit %
  watcherAuthToken: process.env.WATCHER_AUTH_TOKEN || "",
  minConfirmations: {
    cUSD_CELO: Number(process.env.MIN_CONFIRMATIONS_CUSD_CELO || 1),
    USDC_BASE: Number(process.env.MIN_CONFIRMATIONS_USDC_BASE || 1),
    USDCX_STACKS: Number(process.env.MIN_CONFIRMATIONS_USDCX_STACKS || 1),
  },
  depositWallets: {
    cUSD_CELO: process.env.DEPOSIT_WALLET_CELO || process.env.X402_SERVER_WALLET || "",
    USDC_BASE: process.env.DEPOSIT_WALLET_BASE || process.env.X402_SERVER_WALLET || "",
    USDCX_STACKS: process.env.DEPOSIT_WALLET_STACKS || "",
  },
  orderExpiryMs: Number(process.env.ORDER_EXPIRY_MS || 30 * 60 * 1000), // 30 min
  rpcUrls: {
    // Support both naming styles to avoid env mismatch during deploys.
    celo: process.env.RPC_URL_CELO || process.env.CELO_RPC_URL || "https://forno.celo.org",
    base: process.env.RPC_URL_BASE || process.env.BASE_RPC_URL || "https://mainnet.base.org",
  },
  // Delay watcher-triggered verification to allow tx propagation/finality.
  settlementPrecheckDelayMs: Number(process.env.SETTLEMENT_PRECHECK_DELAY_MS || 40000),
  settlementVerifyRetryDelayMs: Number(process.env.SETTLEMENT_VERIFY_RETRY_DELAY_MS || 15000),
  settlementVerifyMaxAttempts: Number(process.env.SETTLEMENT_VERIFY_MAX_ATTEMPTS || 3),
  paystackMode: (process.env.PAYSTACK_MODE || "mock").toLowerCase(),
  paystackBaseUrl: process.env.PAYSTACK_BASE_URL || "https://api.paystack.co",
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || "",
  paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || ""
};
