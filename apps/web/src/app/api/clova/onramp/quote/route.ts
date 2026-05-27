import { NextResponse } from "next/server";
import { getLiveRateV2 } from "@/lib/clovaFallback";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

    const { network, token, amount, fiat } = body;
    if (!network || !token || !amount || !fiat) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const data = await getLiveRateV2(network, token, amount, fiat);
    if (!data) {
      return NextResponse.json({ error: "failed_to_fetch_rate" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: "server_error", detail: err.message }, { status: 500 });
  }
}
