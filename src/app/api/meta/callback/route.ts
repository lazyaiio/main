import { NextResponse, type NextRequest } from "next/server";
import { getAppContext } from "@/lib/auth/session";
import { ServiceError } from "@/lib/services/errors";
import { completeCallback } from "@/lib/services/social";
import { FLOW_COOKIE } from "@/lib/social/flow";

export const dynamic = "force-dynamic";

/**
 * Where Facebook sends the person back after they approve (or cancel). The address must be listed
 * under "Valid OAuth Redirect URIs" in the Meta app. The URL contains a one-time code, so it is never
 * logged, and the answer is never cached.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const finish = (path: string) => {
    const response = NextResponse.redirect(new URL(path, origin));
    response.cookies.set(FLOW_COOKIE, "", { path: "/api/meta", maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  const ctx = await getAppContext();
  if (!ctx) return finish("/auth/login");

  const params = request.nextUrl.searchParams;
  try {
    const flowId = await completeCallback(ctx, {
      code: params.get("code"),
      state: params.get("state"),
      cookieValue: request.cookies.get(FLOW_COOKIE)?.value,
      providerError: params.get("error") ?? params.get("error_reason"),
    });
    return finish(`/app/pages/connect?flow=${flowId}`);
  } catch (error) {
    const kind = error instanceof ServiceError ? error.kind : "failed";
    return finish(`/app/pages?error=${kind}`);
  }
}
