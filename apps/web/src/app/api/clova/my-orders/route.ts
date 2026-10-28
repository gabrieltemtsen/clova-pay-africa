import { NextResponse } from "next/server";
import { checkBackendHealthy, listOrdersByAddress } from "@/lib/clovaFallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  if (address.length < 8 || address.length > 128) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  const base = process.env.CLOVA_API_URL;
  const isHealthy = await checkBackendHealthy();

  if (!base || !isHealthy) {
    try {
      const orders = await listOrdersByAddress(address);
      return NextResponse.json({ ok: true, orders });
    } catch (err: any) {
      return NextResponse.json({ ok: true, orders: [], degraded: true, detail: err?.message });
    }
  }

  try {
    const r = await fetch(`${base}/v1/address/${encodeURIComponent(address)}/orders`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch {
    const orders = await listOrdersByAddress(address).catch(() => []);
    return NextResponse.json({ ok: true, orders, degraded: true });
  }
}

