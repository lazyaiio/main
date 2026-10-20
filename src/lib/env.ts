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
