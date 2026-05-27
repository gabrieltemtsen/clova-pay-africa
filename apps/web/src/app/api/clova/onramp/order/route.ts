import { NextResponse } from "next/server";
import { createOnrampOrder } from "@/lib/clovaFallback";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

    const order = await createOnrampOrder(body);
    return NextResponse.json(order);
  } catch (err: any) {
    return NextResponse.json({ error: "failed_to_create_order", detail: err.message }, { status: 500 });
  }
}
