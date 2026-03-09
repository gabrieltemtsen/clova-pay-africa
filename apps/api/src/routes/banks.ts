import { Router } from "express";
import { PaycrestProvider } from "../providers/paycrest.js";

export const banksRouter = Router();
const paycrest = new PaycrestProvider();

// ----- GET /v1/banks — discover supported payout institutions ------
banksRouter.get("/v1/banks", async (req, res) => {
    const currency = String(req.query.currency || "NGN");
    const institutions = await paycrest.getSupportedInstitutions(currency);
    return res.json({ currency, institutions });
});
