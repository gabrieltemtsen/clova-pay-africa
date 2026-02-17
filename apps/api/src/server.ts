import "dotenv/config";
import express from "express";
import { config } from "./lib/config.js";
import { healthRouter } from "./routes/health.js";
import { quoteRouter } from "./routes/quote.js";
import { payoutRouter } from "./routes/payout.js";

const app = express();
app.use(express.json());

app.use(healthRouter);
app.use(quoteRouter);
app.use(payoutRouter);

app.listen(config.port, () => {
  console.log(`[clova-api] listening on :${config.port}`);
});
