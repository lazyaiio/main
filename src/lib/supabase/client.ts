import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/** Browser client. Uses only the public URL and anon key; RLS protects the data. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
