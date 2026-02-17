import { Router } from "express";
import path from "node:path";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  return res.json({ ok: true, service: "clova-api" });
});

healthRouter.get("/demo", (_req, res) => {
  res.sendFile(path.resolve("src/demo.html"));
});
