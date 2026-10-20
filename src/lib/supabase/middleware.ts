import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideRoute } from "@/lib/auth/route-guard";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/** Refreshes the Supabase session cookie and applies the route rules. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let isAuthed = false;

  const env = getSupabasePublicEnv();
  if (env) {
    const supabase = createServerClient<Database>(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    // getUser() validates the token with Supabase; never trust getSession() on the server.
    const { data } = await supabase.auth.getUser();
    isAuthed = Boolean(data.user);
  }

  const decision = decideRoute({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    isAuthed,
  });

  if (decision.type === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.pathname;
    url.search = decision.search ?? "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}
