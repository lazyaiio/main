import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/** Name of the setting (shown to admins when it is missing). */
export const ADMIN_KEY_ENV_NAME = "SUPABASE_SERVICE_ROLE_KEY";

/**
 * Service-role client: BYPASSES Row Level Security. Server code only, for jobs and trusted
 * operations. Never import this from a client component and never return its data unchecked.
 */
export function createAdminClient() {
  const env = getSupabasePublicEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !serviceKey) {
    throw new Error("The Supabase admin client is not configured.");
  }
  return createClient<Database>(env.url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** True when the server has what it needs to create the admin client (never reveals the key). */
export function isAdminClientConfigured(): boolean {
  return Boolean(getSupabasePublicEnv() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
