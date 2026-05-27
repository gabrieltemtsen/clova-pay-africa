import { NextResponse } from "next/server";
import { checkBackendHealthy, getSupportedInstitutions } from "@/lib/clovaFallback";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const currency = (url.searchParams.get("currency") || "NGN").toUpperCase();

  const base = process.env.CLOVA_API_URL;
  const isHealthy = await checkBackendHealthy();

  if (!base || !isHealthy) {
    console.log(`[banks-api] Using local fallback for ${currency}`);
    try {
      const institutions = await getSupportedInstitutions(currency);
      return NextResponse.json({ currency, institutions });
    } catch (err: any) {
      return NextResponse.json({ error: "fallback_failed", detail: err.message }, { status: 500 });
    }
  }

  const r = await fetch(`${base}/v1/banks?currency=${encodeURIComponent(currency)}`, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.CLOVA_OWNER_API_KEY || "",
    },
    // Avoid Next caching for dynamic resources
    cache: "no-store",
  });

  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}

