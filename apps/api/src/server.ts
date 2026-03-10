import "dotenv/config";
import express from "express";
import cors from "cors";
import { config } from "./lib/config.js";
import { healthRouter } from "./routes/health.js";
import { banksRouter } from "./routes/banks.js";

import { quoteRouter } from "./routes/quote.js";
import { payoutRouter } from "./routes/payout.js";
import { webhookRouter } from "./routes/webhook.js";
import { liquidityRouter } from "./routes/liquidity.js";
import { settlementRouter } from "./routes/settlement.js";
import { watcherRouter } from "./routes/watcher.js";
import { orderRouter } from "./routes/order.js";
import { ledger } from "./lib/ledger.js";
import { startExpiryWorker } from "./lib/expiryWorker.js";
import { startStacksWatcher } from "./lib/stacksWatcher.js";
import { startTreasuryFunder } from "./lib/treasuryFunder.js";
import { requirePaidAccess } from "./middleware/access.js";

const app = express();
app.use(cors());
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf.toString("utf8");
  },
}));

app.use(healthRouter);
app.use(banksRouter);   // public resource listing
app.use(webhookRouter); // provider callback; never paid
app.use(watcherRouter); // watcher callback; token-gated


// Paid APIs (x402), with OWNER_API_KEY bypass for internal/admin calls.
app.use(requirePaidAccess(process.env.X402_PRICE_QUOTE || "$0.001"), quoteRouter);
app.use(requirePaidAccess(process.env.X402_PRICE_PAYOUT || "$0.02"), payoutRouter);
app.use(requirePaidAccess(process.env.X402_PRICE_PAYOUT || "$0.02"), orderRouter);
app.use(requirePaidAccess(process.env.X402_PRICE_LIQUIDITY || "$0.005"), liquidityRouter);
app.use(requirePaidAccess(process.env.X402_PRICE_SETTLEMENT || "$0.005"), settlementRouter);

ledger.init().then(() => {
  startExpiryWorker();
  startStacksWatcher();
  startTreasuryFunder();
  app.listen(config.port, () => {
    console.log(`[clova-api] listening on :${config.port}`);
  });
}).catch((e) => {
  console.error("[clova-api] failed to init ledger", e);
  process.exit(1);
});
