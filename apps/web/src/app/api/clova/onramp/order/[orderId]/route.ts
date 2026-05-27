import { NextResponse } from "next/server";
import { getOnrampOrder } from "@/lib/clovaFallback";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await ctx.params;
    const order = await getOnrampOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (err: any) {
    return NextResponse.json({ error: "failed_to_fetch_order", detail: err.message }, { status: 500 });
  }
}
