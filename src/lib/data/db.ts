import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type Db = SupabaseClient;

/**
 * Request-scoped database client (runs as the signed-in user, so RLS always applies).
 * Typed loosely on purpose: row shapes live in ./types.ts and are applied explicitly.
 */
export async function getDb(): Promise<Db> {
  return (await createClient()) as unknown as SupabaseClient;
}

export class DataError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "DataError";
  }
}

/** Throws a safe error (no query details) when a Supabase call failed. */
export function unwrap<T>(result: { data: T | null; error: { code?: string } | null }, what: string): T | null {
  if (result.error) throw new DataError(`Could not ${what}.`, result.error.code);
  return result.data;
}
