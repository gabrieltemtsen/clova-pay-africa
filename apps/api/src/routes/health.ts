import { Router } from "express";
import path from "node:path";
import { config } from "../lib/config.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  return res.json({
    ok: true,
    service: "clova-api",
    paycrestMode: config.paycrestMode,   // "live" | "mock" — exposed for demo UI warning
    paystackMode: config.paystackMode,   // always "mock" (suspended)
  });
});

healthRouter.get("/demo", (_req, res) => {
  res.sendFile(path.resolve("src/demo.html"));
});
