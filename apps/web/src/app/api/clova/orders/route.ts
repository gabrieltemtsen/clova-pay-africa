import { NextResponse } from "next/server";
import { checkBackendHealthy, createOrder } from "@/lib/clovaFallback";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const base = process.env.CLOVA_API_URL;
  const isHealthy = await checkBackendHealthy();

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  if (!base || !isHealthy) {
    console.log(`[orders-api] Using local fallback for order:`, body);
    try {
      const order = await createOrder(body);
      return NextResponse.json(order);
    } catch (err: any) {
      return NextResponse.json({ error: "fallback_failed", detail: err.message }, { status: 500 });
    }
  }

  const r = await fetch(`${base}/v1/orders`, {
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

