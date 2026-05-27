import { NextResponse } from "next/server";
import { checkBackendHealthy, getLiveRateV2 } from "@/lib/clovaFallback";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

    const { network, token, amount, fiat } = body;
    if (!network || !token || !amount || !fiat) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // Try proxying to healthy backend first
    const base = process.env.CLOVA_API_URL;
    const isHealthy = await checkBackendHealthy();
    if (base && isHealthy) {
      try {
        console.log(`[quote-api] Proxying buy rate request to backend: ${base}/v1/onramp/quote`);
        const r = await fetch(`${base}/v1/onramp/quote`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.CLOVA_OWNER_API_KEY || "",
          },
          body: JSON.stringify(body),
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok) {
          return NextResponse.json(data);
        }
      } catch (err: any) {
        console.warn("[quote-api] Proxy to backend failed, using local fallback:", err.message);
      }
    }

    const data = await getLiveRateV2(network, token, amount, fiat);
    if (!data) {
      return NextResponse.json({ error: "failed_to_fetch_rate" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: "server_error", detail: err.message }, { status: 500 });
  }
}
