import { NextResponse } from "next/server";
import { verifyAccount } from "@/lib/clovaFallback";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const institution = String(body.institution || body.bankCode || "").trim();
    const accountIdentifier = String(body.accountIdentifier || body.accountNumber || "").trim();
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : undefined;

    if (!institution || !accountIdentifier) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const res = await verifyAccount(institution, accountIdentifier, metadata);
    if (!res.verified) {
      return NextResponse.json(
        { ok: false, verified: false, error: "Account verification failed" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      verified: true,
      accountName: res.accountName,
      lookupSupported: res.lookupSupported,
      institution: res.bankCode,
      accountIdentifier: res.accountNumber,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, verified: false, error: err?.message || "Account verification failed" },
      { status: 422 }
    );
  }
}
