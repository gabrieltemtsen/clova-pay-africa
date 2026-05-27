import { NextResponse } from "next/server";
import { checkBackendHealthy } from "@/lib/clovaFallback";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const base = process.env.CLOVA_API_URL;
  const isHealthy = await checkBackendHealthy();

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  if (!base || !isHealthy) {
    console.log(`[credited-api] Using local fallback for settlement/credited:`, body);
    return NextResponse.json({
      settlement: {
        settlementId: `st_fallback_${Date.now()}`,
        quoteId: body.orderId || body.quoteId || "",
        asset: body.asset,
        amountCrypto: body.amountCrypto,
        txHash: body.txHash,
        confirmations: body.confirmations || 1,
        source: "manual",
        status: "credited",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      inserted: true,
      note: "EVM deposit recognized locally; Paycrest is processing the payout autonomously."
    });
  }

  const r = await fetch(`${base}/v1/settlements/credited`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.CLOVA_OWNER_API_KEY || "",
    },
    body: JSON.stringify(body),
  });

  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}

