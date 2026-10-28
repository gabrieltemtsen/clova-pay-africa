import { NextResponse } from "next/server";
import { handlePaycrestWebhook, verifyPaycrestWebhookSignature } from "@/lib/clovaFallback";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paycrest-signature") || undefined;

    if (!verifyPaycrestWebhookSignature(rawBody, signature)) {
      console.warn("[webhook-api] Invalid Paycrest webhook signature");
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const result = await handlePaycrestWebhook(payload);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("[webhook-api] Paycrest webhook processing failed:", err);
    return NextResponse.json({ error: "webhook_failed", detail: err?.message }, { status: 500 });
  }
}

