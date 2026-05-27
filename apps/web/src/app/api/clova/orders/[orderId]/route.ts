import { NextResponse } from "next/server";
import { checkBackendHealthy, getOrder } from "@/lib/clovaFallback";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params;

  const base = process.env.CLOVA_API_URL;
  const isHealthy = await checkBackendHealthy();

  if (!base || !isHealthy) {
    console.log(`[orderId-api] Using local fallback for getOrder: ${orderId}`);
    try {
      const order = await getOrder(orderId);
      return NextResponse.json(order);
    } catch (err: any) {
      return NextResponse.json({ error: "fallback_failed", detail: err.message }, { status: 500 });
    }
  }

  const r = await fetch(`${base}/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.CLOVA_OWNER_API_KEY || "",
    },
    cache: "no-store",
  });

  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}

