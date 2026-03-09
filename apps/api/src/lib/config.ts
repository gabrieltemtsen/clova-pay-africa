export const config = {
  port: Number(process.env.PORT || 8787),
  defaultFeeBps: Number(process.env.DEFAULT_FEE_BPS || 150),
  defaultNgnRate: Number(process.env.DEFAULT_NGN_RATE || 1500),
  rateMarginPct: Number(process.env.RATE_MARGIN_PCT || 3),
  watcherAuthToken: process.env.WATCHER_AUTH_TOKEN || "",
  minConfirmations: {
    cUSD_CELO: Number(process.env.MIN_CONFIRMATIONS_CUSD_CELO || 1),
    USDC_BASE: Number(process.env.MIN_CONFIRMATIONS_USDC_BASE || 1),
    USDCX_STACKS: Number(process.env.MIN_CONFIRMATIONS_USDCX_STACKS || 1),
  },
  // Deposit wallets — used for USDCX_STACKS (Clarity contract address).
  // For USDC_BASE and cUSD_CELO, Paycrest provides its own deposit address per order.
  depositWallets: {
    cUSD_CELO: process.env.DEPOSIT_WALLET_CELO || "",
    USDC_BASE: process.env.DEPOSIT_WALLET_BASE || "",
    USDCX_STACKS: process.env.DEPOSIT_WALLET_STACKS || "",   // Clarity contract principal
  },
  orderExpiryMs: Number(process.env.ORDER_EXPIRY_MS || 30 * 60 * 1000),
  rpcUrls: {
    celo: process.env.RPC_URL_CELO || process.env.CELO_RPC_URL || "https://forno.celo.org",
    base: process.env.RPC_URL_BASE || process.env.BASE_RPC_URL || "https://mainnet.base.org",
    stacks: process.env.RPC_URL_STACKS || "https://api.mainnet.hiro.so",
  },
  settlementPrecheckDelayMs: Number(process.env.SETTLEMENT_PRECHECK_DELAY_MS || 40000),
  settlementVerifyRetryDelayMs: Number(process.env.SETTLEMENT_VERIFY_RETRY_DELAY_MS || 15000),
  settlementVerifyMaxAttempts: Number(process.env.SETTLEMENT_VERIFY_MAX_ATTEMPTS || 3),

  // --- Paycrest (primary payout rail) ---
  paycrestMode: (process.env.PAYCREST_MODE || "mock").toLowerCase(),
  paycrestApiKey: process.env.PAYCREST_API_KEY || "",
  paycrestBaseUrl: process.env.PAYCREST_BASE_URL || "https://api.paycrest.io/v1",
  paycrestWebhookSecret: process.env.PAYCREST_WEBHOOK_SECRET || "",
  // URL PayCrest will POST order status events to. Set to your ngrok/public URL in .env
  paycrestWebhookUrl: process.env.PAYCREST_WEBHOOK_URL || "",

  // USDC/Base reserve wallet used to front Stacks payouts
  // (USDCx received via Clarity contract; Paycrest order is funded from this reserve)
  stacksReserveWallet: process.env.STACKS_RESERVE_WALLET || "",

  // --- Paystack (SUSPENDED — kept for reference only) ---
  // paystackMode: "suspended",
  paystackMode: "mock",   // always mock until further notice
  paystackBaseUrl: "https://api.paystack.co",
  paystackSecretKey: "",
  paystackWebhookSecret: "",
};
