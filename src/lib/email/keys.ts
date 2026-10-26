import "server-only";
import { getPublicEnv } from "@/lib/env";

/**
 * The only place that reads email settings from the environment.
 *
 *   RESEND_API_KEY         API key from Resend (sending access is enough)
 *   RESEND_FROM_EMAIL      sender, for example  LazyAI <notifications@mail.example.com>
 *   RESEND_WEBHOOK_SECRET  signing secret of the Resend webhook (starts with whsec_)
 */

const FROM_RE = /^(?:[^<>\r\n"]{1,80} <[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/;

export type EmailConfig = { apiKey: string | null; from: string | null; webhookSecret: string | null };

export function getEmailConfig(): EmailConfig {
  const apiKey = process.env.RESEND_API_KEY?.trim() || null;
  const from = process.env.RESEND_FROM_EMAIL?.trim() || null;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim() || null;
  return { apiKey, from: from && FROM_RE.test(from) ? from : null, webhookSecret };
}

/** What is missing, by name only (never values). */
export function getEmailSetup(): { sendingReady: boolean; webhookReady: boolean; missing: string[]; invalidFrom: boolean } {
  const rawFrom = process.env.RESEND_FROM_EMAIL?.trim() || "";
  const config = getEmailConfig();
  const missing: string[] = [];
  if (!config.apiKey) missing.push("RESEND_API_KEY");
  if (!rawFrom) missing.push("RESEND_FROM_EMAIL");
  return {
    sendingReady: Boolean(config.apiKey && config.from),
    webhookReady: Boolean(config.webhookSecret),
    missing,
    invalidFrom: Boolean(rawFrom) && !config.from,
  };
}

export function getAppBaseUrl(): string {
  return getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}
