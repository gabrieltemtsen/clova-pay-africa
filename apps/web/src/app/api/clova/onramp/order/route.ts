import { NextResponse } from "next/server";
import { checkBackendHealthy, createOnrampOrder } from "@/lib/clovaFallback";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

    // Try proxying to healthy backend first
    const base = process.env.CLOVA_API_URL;
    const isHealthy = await checkBackendHealthy();
    if (base && isHealthy) {
      try {
        console.log(`[onramp-order-api] Proxying order creation to backend: ${base}/v1/onramp/orders`);
        const r = await fetch(`${base}/v1/onramp/orders`, {
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
        console.warn("[onramp-order-api] Proxy to backend failed, using local fallback:", err.message);
      }
    }

    const order = await createOnrampOrder(body);
    return NextResponse.json(order);
  } catch (err: any) {
    return NextResponse.json({ error: "failed_to_create_order", detail: err.message }, { status: 500 });
  }
}
