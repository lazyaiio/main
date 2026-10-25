import "server-only";
import { getPublicEnv } from "@/lib/env";
import { ADMIN_KEY_ENV_NAME, isAdminClientConfigured } from "@/lib/supabase/admin";
import { DEFAULT_GRAPH_VERSION, createMetaProvider } from "./meta-provider";
import { createMockProvider } from "./mock-provider";
import type { SocialPublishingProvider } from "./provider";

/**
 * The only place that reads Meta settings from the environment.
 *
 *   META_APP_ID, META_APP_SECRET      the Meta app (App settings -> Basic)
 *   META_REDIRECT_URI                 optional; default is <app url>/api/meta/callback
 *   META_GRAPH_API_VERSION            optional; default v25.0
 *   META_LOGIN_CONFIG_ID              optional; Facebook Login for Business configuration id
 *   TOKEN_ENCRYPTION_KEY              a random string of 32+ characters (encrypts stored Page tokens)
 *   META_MOCK=1                       preview/development only: pretend Facebook (never in production)
 */

export type SocialMode = "meta" | "mock" | "off";

function text(value: string | undefined): string {
  return (value ?? "").trim();
}

export function isMockEnabled(): boolean {
  return process.env.META_MOCK === "1" && process.env.VERCEL_ENV !== "production";
}

/** The Meta app secret, for checking requests that Meta signs. Server only. */
export function getMetaAppSecret(): string | null {
  return text(process.env.META_APP_SECRET) || null;
}

export function getTokenEncryptionKey(): string | null {
  const key = text(process.env.TOKEN_ENCRYPTION_KEY);
  return key.length >= 32 ? key : null;
}

export function getRedirectUri(): string {
  const explicit = text(process.env.META_REDIRECT_URI);
  if (explicit) return explicit;
  return `${getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/meta/callback`;
}

function graphVersion(): string {
  const version = text(process.env.META_GRAPH_API_VERSION);
  return /^v\d{1,3}\.\d{1,2}$/.test(version) ? version : DEFAULT_GRAPH_VERSION;
}

export function getSocialMode(): SocialMode {
  if (isMockEnabled()) return "mock";
  return text(process.env.META_APP_ID) && text(process.env.META_APP_SECRET) ? "meta" : "off";
}

export function getSocialProvider(): SocialPublishingProvider | null {
  const mode = getSocialMode();
  if (mode === "mock") return createMockProvider();
  if (mode !== "meta") return null;
  return createMetaProvider({
    appId: text(process.env.META_APP_ID),
    appSecret: text(process.env.META_APP_SECRET),
    apiVersion: graphVersion(),
    loginConfigId: text(process.env.META_LOGIN_CONFIG_ID) || null,
  });
}

/** What is still missing, by variable name only (never values), so the page can say what to add. */
export function getSocialSetup(): { mode: SocialMode; ready: boolean; missing: string[]; redirectUri: string } {
  const mode = getSocialMode();
  const missing: string[] = [];
  if (mode === "off") {
    if (!text(process.env.META_APP_ID)) missing.push("META_APP_ID");
    if (!text(process.env.META_APP_SECRET)) missing.push("META_APP_SECRET");
  }
  if (!getTokenEncryptionKey()) missing.push("TOKEN_ENCRYPTION_KEY");
  if (!isAdminClientConfigured()) missing.push(ADMIN_KEY_ENV_NAME);
  return { mode, ready: mode !== "off" && missing.length === 0, missing, redirectUri: getRedirectUri() };
}

/** The shared secret that protects the scheduler endpoint. Unset means the endpoint refuses everything. */
export function getCronSecret(): string | null {
  const value = text(process.env.CRON_SECRET);
  return value.length >= 16 ? value : null;
}

/**
 * Whether the dispatcher may actually publish. The pretend Facebook always may. The real one only when
 * an admin has switched live publishing on (LIVE_PUBLISHING_ENABLED=1), so connecting a Page never
 * starts posting by surprise.
 */
export function isPublishingEnabled(): boolean {
  const mode = getSocialMode();
  if (mode === "mock") return true;
  return mode === "meta" && text(process.env.LIVE_PUBLISHING_ENABLED) === "1";
}
