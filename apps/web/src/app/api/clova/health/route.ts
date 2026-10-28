import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: "nextjs-serverless",
    paycrest: "v2",
    timestamp: Date.now(),
  });
}

