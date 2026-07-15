import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.CLOVA_API_URL;
  if (!base) {
    return NextResponse.json({ error: "api_not_configured" }, { status: 503 });
  }

  try {
    const r = await fetch(`${base}/v1/stats`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (err: any) {
    return NextResponse.json({ error: "upstream_unreachable", detail: err?.message }, { status: 502 });
  }
}
