export const config = {
  port: Number(process.env.PORT || 8787),
  defaultFeeBps: Number(process.env.DEFAULT_FEE_BPS || 150),
  defaultNgnRate: Number(process.env.DEFAULT_NGN_RATE || 1500),
  watcherAuthToken: process.env.WATCHER_AUTH_TOKEN || "",
  minConfirmations: {
    cUSD_CELO: Number(process.env.MIN_CONFIRMATIONS_CUSD_CELO || 1),
    USDC_BASE: Number(process.env.MIN_CONFIRMATIONS_USDC_BASE || 1),
    USDCX_STACKS: Number(process.env.MIN_CONFIRMATIONS_USDCX_STACKS || 1),
  },
  paystackMode: (process.env.PAYSTACK_MODE || "mock").toLowerCase(),
  paystackBaseUrl: process.env.PAYSTACK_BASE_URL || "https://api.paystack.co",
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || "",
  paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || ""
};
