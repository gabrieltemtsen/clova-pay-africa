import "dotenv/config";
import express from "express";
import { config } from "./lib/config.js";
import { healthRouter } from "./routes/health.js";
import { quoteRouter } from "./routes/quote.js";
import { payoutRouter } from "./routes/payout.js";
import { webhookRouter } from "./routes/webhook.js";
import { liquidityRouter } from "./routes/liquidity.js";
import { settlementRouter } from "./routes/settlement.js";
import { ledger } from "./lib/ledger.js";

const app = express();
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf.toString("utf8");
  },
}));

app.use(healthRouter);
app.use(quoteRouter);
app.use(payoutRouter);
app.use(webhookRouter);
app.use(liquidityRouter);
app.use(settlementRouter);

ledger.init().then(() => {
  app.listen(config.port, () => {
    console.log(`[clova-api] listening on :${config.port}`);
  });
}).catch((e) => {
  console.error("[clova-api] failed to init ledger", e);
  process.exit(1);
});
