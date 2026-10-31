import "server-only";
import { z } from "zod";
import { SESSION_GAP_MINUTES, classifySource, cleanUtm, isBot, normalizePath, parseUserAgent, utcDay, visitorHash } from "@/lib/analytics";
import { findRecentSession, insertPageview, readAnalyticsSettings, type AnalyticsSettings } from "@/lib/data/analytics";
import { getTokenEncryptionKey } from "@/lib/social/keys";

const payload = z.object({
  path: z.string().max(300),
  referrer: z.string().max(500).optional().default(""),
  utm_source: z.string().max(80).optional(),
  utm_medium: z.string().max(80).optional(),
  utm_campaign: z.string().max(80).optional(),
});

/** The settings are read at most once a minute per server instance. */
let cached: { at: number; value: AnalyticsSettings } | null = null;
async function settings(): Promise<AnalyticsSettings> {
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  const value = await readAnalyticsSettings();
  cached = { at: Date.now(), value };
  return value;
}
export function forgetAnalyticsSettings() {
  cached = null;
}

export type IngestResult = "counted" | "ignored";

/**
 * Counts one page view from the browser beacon. Everything is validated; anything odd is ignored quietly.
 * Nothing identifying is stored: the IP address and the browser string are used only to make a one-way,
 * daily-changing label, and are then discarded.
 */
export async function ingestPageview(input: { body: unknown; userAgent: string; ip: string; country: string | null; originHost: string | null; ownHost: string }): Promise<IngestResult> {
  if (!(await settings()).enabled) return "ignored";
  if (input.originHost && input.originHost.replace(/^www\./, "") !== input.ownHost.replace(/^www\./, "")) return "ignored";
  if (isBot(input.userAgent)) return "ignored";

  const parsed = payload.safeParse(input.body);
  if (!parsed.success) return "ignored";
  const path = normalizePath(parsed.data.path);
  if (!path) return "ignored";

  const utmSource = cleanUtm(parsed.data.utm_source);
  const utmMedium = cleanUtm(parsed.data.utm_medium);
  const utmCampaign = cleanUtm(parsed.data.utm_campaign);
  const source = classifySource({ referrer: parsed.data.referrer, ownHost: input.ownHost, utmSource, utmMedium });
  const agent = parseUserAgent(input.userAgent);

  const secret = getTokenEncryptionKey();
  const now = new Date();
  const hash = secret ? visitorHash(secret, utcDay(now), input.ip, input.userAgent) : null;
  let sessionId: string | null = null;
  if (hash) sessionId = await findRecentSession(hash, new Date(now.getTime() - SESSION_GAP_MINUTES * 60_000).toISOString());

  await insertPageview({
    path,
    referrer_host: source.referrerHost,
    source: source.source,
    source_name: source.name ? source.name.slice(0, 120) : null,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    country: input.country && /^[A-Z]{2}$/.test(input.country) ? input.country : null,
    device: agent.device,
    browser: agent.browser,
    os: agent.os,
    visitor_hash: hash,
    session_id: sessionId ?? crypto.randomUUID(),
    is_entry: sessionId === null,
  });
  return "counted";
}
