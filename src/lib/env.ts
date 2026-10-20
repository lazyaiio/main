import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

type EnvSource = Record<string, string | undefined>;

/**
 * Resolve the public base URL of the app.
 * Order: NEXT_PUBLIC_APP_URL -> Vercel-provided host -> localhost (development only).
 */
export function resolveAppUrl(source: EnvSource): string {
  const explicit = source.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit;
  const vercelHost = source.VERCEL_PROJECT_PRODUCTION_URL?.trim() || source.VERCEL_URL?.trim();
  if (vercelHost) return `https://${vercelHost}`;
  return "http://localhost:3000";
}

export function parsePublicEnv(source: EnvSource): PublicEnv {
  return publicEnvSchema.parse({ NEXT_PUBLIC_APP_URL: resolveAppUrl(source) });
}

export function getPublicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  });
}

const supabaseEnvSchema = z.object({
  url: z.string().url(),
  anonKey: z.string().min(20),
});

export type SupabasePublicEnv = z.infer<typeof supabaseEnvSchema>;

/** Returns null when Supabase is not (correctly) configured, so the site can still run. */
export function parseSupabasePublicEnv(source: EnvSource): SupabasePublicEnv | null {
  const url = source.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = source.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  const parsed = supabaseEnvSchema.safeParse({ url, anonKey });
  return parsed.success ? parsed.data : null;
}

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  return parseSupabasePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicEnv() !== null;
}
