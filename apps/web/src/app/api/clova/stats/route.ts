import { NextResponse } from "next/server";
import { checkBackendHealthy, getNetworkStats } from "@/lib/clovaFallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.CLOVA_API_URL;
  const isHealthy = await checkBackendHealthy();

  if (!base || !isHealthy) {
    try {
      const stats = await getNetworkStats();
      return NextResponse.json(stats);
    } catch (err: any) {
      return NextResponse.json({ error: "stats_unavailable", detail: err?.message }, { status: 500 });
    }
  }

  try {
    const r = await fetch(`${base}/v1/stats`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch {
    const stats = await getNetworkStats();
    return NextResponse.json(stats);
  }
}

