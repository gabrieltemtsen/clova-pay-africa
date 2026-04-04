import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const currency = (url.searchParams.get("currency") || "NGN").toUpperCase();

  const base = process.env.CLOVA_API_URL;
  if (!base) {
    return NextResponse.json({ error: "CLOVA_API_URL_not_set" }, { status: 500 });
  }

  const r = await fetch(`${base}/v1/banks?currency=${encodeURIComponent(currency)}`, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.CLOVA_OWNER_API_KEY || "",
    },
    // Avoid Next caching for dynamic resources
    cache: "no-store",
  });

  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}
