import { NextResponse } from "next/server";
import { checkBackendHealthy, getOnrampOrder } from "@/lib/clovaFallback";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await ctx.params;

    // Try proxying to healthy backend first
    const base = process.env.CLOVA_API_URL;
    const isHealthy = await checkBackendHealthy();
    if (base && isHealthy) {
      try {
        console.log(`[onramp-order-status-api] Proxying status check to backend: ${base}/v1/onramp/orders/${orderId}`);
        const r = await fetch(`${base}/v1/onramp/orders/${orderId}`, {
          headers: {
            "x-api-key": process.env.CLOVA_OWNER_API_KEY || "",
          },
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok) {
          return NextResponse.json(data);
        }
      } catch (err: any) {
        console.warn("[onramp-order-status-api] Proxy to backend failed, using local fallback:", err.message);
      }
    }

    const order = await getOnrampOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (err: any) {
    return NextResponse.json({ error: "failed_to_fetch_order", detail: err.message }, { status: 500 });
  }
}
