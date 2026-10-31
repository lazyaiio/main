import { createHmac } from "node:crypto";

/**
 * First-party, cookie-free website statistics. Pure helpers (no database, no network) so they are easy to test.
 * Privacy by design: no IP address is stored, no cookie is set, and the "visitor" label is a one-way hash that
 * changes every day, so a person cannot be followed from one day to the next.
 */

export type Device = "desktop" | "mobile" | "tablet";
export type SourceKind = "direct" | "search" | "social" | "email" | "paid" | "campaign" | "referral";

// ---------- Which requests to ignore ----------
const BOT = /bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python|java\/|go-http|okhttp|libwww|monitor|uptime|check_http|vercel|scrapy|httpclient|axios|node-fetch/i;

export function isBot(userAgent: string): boolean {
  return userAgent.trim().length < 10 || BOT.test(userAgent);
}

export function parseUserAgent(userAgent: string): { device: Device; browser: string; os: string } {
  const ua = userAgent;
  const device: Device = /ipad|tablet|(android(?!.*mobile))/i.test(ua) ? "tablet" : /mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua) ? "mobile" : "desktop";

  let browser = "Other";
  if (/edg(e|a|ios)?\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/samsungbrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/ucbrowser/i.test(ua)) browser = "UC Browser";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/chrome|crios|chromium/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && /version\//i.test(ua)) browser = "Safari";
  else if (/trident|msie/i.test(ua)) browser = "Internet Explorer";

  let os = "Other";
  if (/windows phone/i.test(ua)) os = "Windows Phone";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/cros/i.test(ua)) os = "ChromeOS";
  else if (/linux|x11/i.test(ua)) os = "Linux";
  return { device, browser, os };
}

// ---------- Pages ----------
const SKIP_PREFIXES = ["/app", "/admin", "/api", "/auth", "/onboarding", "/_next"];

/** A clean path to count, or null when the page should not be counted. Query strings and fragments are dropped. */
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const path = raw.split(/[?#]/)[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 200) return null;
  if (!/^\/[A-Za-z0-9/_\-.%]*$/.test(path)) return null;
  if (SKIP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return path.length > 1 ? path.replace(/\/+$/, "") || "/" : path;
}

const UTM = /^[A-Za-z0-9 _\-.+%]{1,60}$/;
export function cleanUtm(value: unknown): string | null {
  return typeof value === "string" && UTM.test(value.trim()) ? value.trim().toLowerCase() : null;
}

// ---------- Where the visit came from ----------
const SEARCH: Record<string, string> = { "google.": "Google", "bing.com": "Bing", "duckduckgo.com": "DuckDuckGo", "yahoo.": "Yahoo", "yandex.": "Yandex", "baidu.com": "Baidu", "ecosia.org": "Ecosia", "search.brave.com": "Brave Search" };
const SOCIAL: Record<string, string> = {
  "facebook.com": "Facebook", "fb.me": "Facebook", "fb.com": "Facebook", "instagram.com": "Instagram", "twitter.com": "X (Twitter)", "x.com": "X (Twitter)", "t.co": "X (Twitter)",
  "linkedin.com": "LinkedIn", "lnkd.in": "LinkedIn", "pinterest.": "Pinterest", "youtube.com": "YouTube", "youtu.be": "YouTube", "reddit.com": "Reddit", "tiktok.com": "TikTok",
  "whatsapp.com": "WhatsApp", "wa.me": "WhatsApp", "telegram.org": "Telegram", "t.me": "Telegram",
};
const EMAIL = ["mail.google.com", "outlook.live.com", "outlook.office.com", "mail.yahoo.com"];

const matchTable = (host: string, table: Record<string, string>): string | null => {
  for (const [needle, name] of Object.entries(table)) if (host === needle.replace(/\.$/, "") || host.endsWith(`.${needle.replace(/\.$/, "")}`) || (needle.endsWith(".") && host.includes(needle))) return name;
  return null;
};

export function hostOf(referrer: unknown): string | null {
  if (typeof referrer !== "string" || !referrer) return null;
  try {
    const u = new URL(referrer);
    return u.protocol === "https:" || u.protocol === "http:" ? u.hostname.toLowerCase().replace(/^www\./, "").slice(0, 120) : null;
  } catch {
    return null;
  }
}

export type SourceInfo = { source: SourceKind; name: string | null; referrerHost: string | null };

/** Works out where a visit came from. A campaign link (utm_*) wins over the referrer. */
export function classifySource(input: { referrer: unknown; ownHost: string; utmSource: string | null; utmMedium: string | null }): SourceInfo {
  const host = hostOf(input.referrer);
  const referrerHost = host && host !== input.ownHost.replace(/^www\./, "") ? host : null;
  if (input.utmSource || input.utmMedium) {
    const medium = input.utmMedium ?? "";
    const source: SourceKind = /^(e-?mail|newsletter)$/.test(medium) ? "email" : /^(social|social-media|sm)$/.test(medium) ? "social" : /^(cpc|ppc|paid|paidsocial|display)/.test(medium) ? "paid" : "campaign";
    return { source, name: input.utmSource ?? medium ?? null, referrerHost };
  }
  if (!referrerHost) return { source: "direct", name: null, referrerHost: null };
  const search = matchTable(referrerHost, SEARCH);
  if (search) return { source: "search", name: search, referrerHost };
  const social = matchTable(referrerHost, SOCIAL);
  if (social) return { source: "social", name: social, referrerHost };
  if (EMAIL.includes(referrerHost)) return { source: "email", name: referrerHost, referrerHost };
  return { source: "referral", name: referrerHost, referrerHost };
}

// ---------- Visitors without cookies ----------
/** One-way label for "the same device today". The secret never leaves the server and the label changes at midnight UTC. */
export function visitorHash(secret: string, day: string, ip: string, userAgent: string): string {
  return createHmac("sha256", secret).update(`analytics|${day}|${ip}|${userAgent}`).digest("hex").slice(0, 32);
}

export const utcDay = (d: Date) => d.toISOString().slice(0, 10);
export const SESSION_GAP_MINUTES = 30;

// ---------- Reporting ranges ----------
export type Bucket = "hour" | "day" | "week" | "month" | "year";
export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "90d" | "12m" | "all";

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "12m", label: "12 months" },
  { key: "all", label: "All time" },
];

export const BUCKET_LABELS: Record<Bucket, string> = { hour: "Hourly", day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly" };

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export function isRangeKey(v: unknown): v is RangeKey {
  return RANGES.some((r) => r.key === v);
}
export function isBucket(v: unknown): v is Bucket {
  return v === "hour" || v === "day" || v === "week" || v === "month" || v === "year";
}

export function defaultBucket(range: RangeKey): Bucket {
  return range === "today" || range === "yesterday" ? "hour" : range === "7d" || range === "30d" ? "day" : range === "90d" ? "week" : "month";
}

/** The buckets that make sense for a range (hours only for a single day, years only for long ranges). */
export function allowedBuckets(range: RangeKey): Bucket[] {
  if (range === "today" || range === "yesterday") return ["hour"];
  if (range === "7d" || range === "30d") return ["day", "week"];
  if (range === "90d") return ["day", "week", "month"];
  if (range === "12m") return ["day", "week", "month"];
  return ["week", "month", "year"];
}

export function resolveRange(range: RangeKey, bucketParam: unknown, now: Date, firstDay?: Date | null): { from: Date; to: Date; bucket: Bucket } {
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + DAY);
  let from = today;
  let to = tomorrow;
  if (range === "yesterday") {
    from = new Date(today.getTime() - DAY);
    to = today;
  } else if (range === "7d") from = new Date(today.getTime() - 6 * DAY);
  else if (range === "30d") from = new Date(today.getTime() - 29 * DAY);
  else if (range === "90d") from = new Date(today.getTime() - 89 * DAY);
  else if (range === "12m") from = new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth() + 1, 1));
  else if (range === "all") from = firstDay ? startOfDay(firstDay) : new Date(today.getTime() - 29 * DAY);
  const bucket = isBucket(bucketParam) && allowedBuckets(range).includes(bucketParam) ? bucketParam : defaultBucket(range);
  return { from, to, bucket };
}

function truncate(d: Date, bucket: Bucket): Date {
  const x = new Date(d);
  if (bucket === "hour") return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), x.getUTCHours()));
  if (bucket === "day") return startOfDay(x);
  if (bucket === "week") {
    const day = (x.getUTCDay() + 6) % 7; // Monday = 0
    return new Date(startOfDay(x).getTime() - day * DAY);
  }
  if (bucket === "month") return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1));
  return new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
}

function next(d: Date, bucket: Bucket): Date {
  if (bucket === "hour") return new Date(d.getTime() + 3_600_000);
  if (bucket === "day") return new Date(d.getTime() + DAY);
  if (bucket === "week") return new Date(d.getTime() + 7 * DAY);
  if (bucket === "month") return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1));
}

export type SeriesPoint = { t: string; views: number; visitors: number; sessions: number };

/** Adds the empty buckets, so a quiet day shows as zero instead of disappearing. `t` is an ISO time at the start of the bucket. */
export function fillBuckets(rows: { t: string; views: number; visitors: number; sessions: number }[], from: Date, to: Date, bucket: Bucket): SeriesPoint[] {
  const byKey = new Map(rows.map((r) => [truncate(new Date(`${r.t.replace(" ", "T")}Z`.replace("ZZ", "Z")), bucket).toISOString(), r]));
  const out: SeriesPoint[] = [];
  for (let d = truncate(from, bucket); d < to && out.length < 800; d = next(d, bucket)) {
    const hit = byKey.get(d.toISOString());
    out.push({ t: d.toISOString(), views: hit?.views ?? 0, visitors: hit?.visitors ?? 0, sessions: hit?.sessions ?? 0 });
  }
  return out;
}

export function bucketLabel(iso: string, bucket: Bucket): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions =
    bucket === "hour" ? { hour: "numeric", timeZone: "UTC" } : bucket === "day" || bucket === "week" ? { month: "short", day: "numeric", timeZone: "UTC" } : bucket === "month" ? { month: "short", year: "2-digit", timeZone: "UTC" } : { year: "numeric", timeZone: "UTC" };
  return d.toLocaleString("en-US", opts);
}

export const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
