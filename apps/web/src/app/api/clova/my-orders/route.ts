import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  if (address.length < 8 || address.length > 128) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  const base = process.env.CLOVA_API_URL;
  if (!base) return NextResponse.json({ ok: true, orders: [] });

  try {
    const r = await fetch(`${base}/v1/address/${encodeURIComponent(address)}/orders`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch {
    return NextResponse.json({ ok: true, orders: [], degraded: true });
  }
}
