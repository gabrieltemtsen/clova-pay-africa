import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params;

  const base = process.env.CLOVA_API_URL;
  if (!base) {
    return NextResponse.json({ error: "CLOVA_API_URL_not_set" }, { status: 500 });
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
