import type { NextFunction, Request, Response } from "express";
import { createThirdwebClient } from "thirdweb";
import { base, celo, celoSepoliaTestnet } from "thirdweb/chains";
import { facilitator, settlePayment } from "thirdweb/x402";

const ownerApiKey = process.env.OWNER_API_KEY || "";

const secretKey = process.env.THIRDWEB_SECRET_KEY;
const serverWalletAddress = process.env.X402_SERVER_WALLET;
const networkName = (process.env.X402_NETWORK || "celo").toLowerCase();

const network =
  networkName === "celo-sepolia"
    ? celoSepoliaTestnet
    : networkName === "base"
      ? base
      : celo;

const canSettle = Boolean(secretKey && serverWalletAddress);

const x402Facilitator = canSettle
  ? facilitator({
      client: createThirdwebClient({ secretKey: secretKey! }),
      serverWalletAddress: serverWalletAddress!,
    })
  : null;

function isOwnerBypass(req: Request) {
  if (!ownerApiKey) return false;
  const incoming = req.header("x-api-key") || req.header("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return incoming.length > 0 && incoming === ownerApiKey;
}

export function requirePaidAccess(price: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (isOwnerBypass(req)) return next();

    const paymentData = req.header("payment-signature") || req.header("x-payment") || undefined;

    if (!canSettle || !x402Facilitator) {
      return res.status(503).json({
        error: "x402_not_configured",
        hint: "Set THIRDWEB_SECRET_KEY and X402_SERVER_WALLET; owner can still use OWNER_API_KEY",
      });
    }

    const resourceUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    const result = await settlePayment({
      resourceUrl,
      method: req.method,
      paymentData,
      payTo: serverWalletAddress!,
      network,
      price,
      facilitator: x402Facilitator,
      routeConfig: {
        description: "Clova Pay paid API endpoint",
        mimeType: "application/json",
      },
    });

    Object.entries(result.responseHeaders).forEach(([k, v]) => res.setHeader(k, String(v)));

    if (result.status !== 200) {
      const body =
        result.responseBody && Object.keys(result.responseBody).length > 0
          ? result.responseBody
          : {
              error: "payment_required",
              status: result.status,
              hint: "Include x-api-key header (owner) or x402 payment header to access this endpoint",
            };
      return res.status(result.status).json(body);
    }

    const receiptHeader = result.responseHeaders["x-payment-response"] || result.responseHeaders["x-payment-receipt-id"];
    if (receiptHeader) res.setHeader("x-payment-receipt-id", String(receiptHeader));

    return next();
  };
}
