import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase is not configured on this deployment.");
    this.name = "SupabaseNotConfiguredError";
  }
}

/** Server client bound to the current request's cookies (runs as the signed-in user, RLS applies). */
export async function createClient() {
  // Read cookies first. This marks every page that touches the database as dynamic, so it is
  // never prerendered at build time (where there is no signed-in user and maybe no Supabase keys).
  const cookieStore = await cookies();
  const env = getSupabasePublicEnv();
  if (!env) throw new SupabaseNotConfiguredError();

  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which cannot set cookies. Middleware refreshes the session.
        }
      },
    },
  });
}
