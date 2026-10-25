import { NextResponse, type NextRequest } from "next/server";
import { handleFacebookCallback } from "@/lib/services/data-deletion";

export const dynamic = "force-dynamic";

/** Meta's "Deauthorize Callback URL": called when a person removes LazyAI in their Facebook settings. */
export async function POST(request: NextRequest) {
  let signed = "";
  try {
    const form = await request.formData();
    const value = form.get("signed_request");
    signed = typeof value === "string" ? value : "";
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const result = await handleFacebookCallback(signed, "facebook_deauthorize");
  if (!result.ok) {
    const status = result.reason === "invalid_signature" ? 400 : result.reason === "not_configured" ? 503 : 500;
    return NextResponse.json({ error: result.reason }, { status, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
