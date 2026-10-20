import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_NEXT = ["/app", "/onboarding", "/auth/reset-password"];

/** Email-link landing: exchanges the one-time code for a session, then goes to a safe page. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"), "/app", ALLOWED_NEXT);

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    } catch {
      // fall through to the error redirect
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=callback`);
}
