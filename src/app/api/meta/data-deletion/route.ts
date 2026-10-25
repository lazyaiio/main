import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";
import { handleFacebookCallback } from "@/lib/services/data-deletion";

export const dynamic = "force-dynamic";

/**
 * Meta's "Data Deletion Request Callback URL". Meta sends a signed request when a person asks to
 * delete their data from Facebook's side. We answer with a confirmation code and a status page.
 */
export async function POST(request: NextRequest) {
  let signed = "";
  try {
    const form = await request.formData();
    const value = form.get("signed_request");
    signed = typeof value === "string" ? value : "";
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = await handleFacebookCallback(signed, "facebook_deletion");
  if (!result.ok) {
    const status = result.reason === "invalid_signature" ? 400 : result.reason === "not_configured" ? 503 : 500;
    return NextResponse.json({ error: result.reason }, { status, headers: { "Cache-Control": "no-store" } });
  }
  const base = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return NextResponse.json(
    { url: `${base}/data-deletion/status?code=${result.code}`, confirmation_code: result.code },
    { headers: { "Cache-Control": "no-store" } },
  );
}
