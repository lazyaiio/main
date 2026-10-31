import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";
import { verifyEmailToken } from "@/lib/services/email-verification";

export const dynamic = "force-dynamic";

/** The link in the verification email. Works whether or not the person is signed in on this device. */
export async function GET(request: NextRequest) {
  const base = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const ok = await verifyEmailToken(request.nextUrl.searchParams.get("token"));
  return NextResponse.redirect(`${base}/app?notice=${ok ? "verified" : "verify_failed"}`, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
