/**
 * Plan limits, as shown to people and checked by the server.
 * The numbers themselves live in the database (table "plans" and per-workspace overrides); this file only
 * knows the names, how to describe them, and how to do the arithmetic. Pure, so it is easy to test.
 */

export const LIMIT_KEYS = ["ai_generations_month", "content_items", "social_pages", "media_files", "media_bytes", "campaigns_open"] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];

export type Limits = Record<LimitKey, number | null>;
export type Usage = Record<LimitKey, number>;

export const LIMIT_LABELS: Record<LimitKey, { label: string; unit: "count" | "bytes"; hint: string }> = {
  ai_generations_month: { label: "AI posts this month", unit: "count", hint: "Resets at the start of each month (UTC)." },
  content_items: { label: "Posts", unit: "count", hint: "All posts and drafts in the workspace." },
  social_pages: { label: "Connected Facebook Pages", unit: "count", hint: "Pages that are connected right now." },
  media_files: { label: "Images", unit: "count", hint: "Images in the media library." },
  media_bytes: { label: "Image storage", unit: "bytes", hint: "Total size of the media library." },
  campaigns_open: { label: "Open campaigns", unit: "count", hint: "Campaigns that are not finished or canceled." },
};

/** Start of the current month in UTC, as an ISO string (used to count monthly AI use). */
export function monthStartUtc(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** 0 to 100, or null when there is no limit. A limit of 0 counts as full. */
export function percentUsed(used: number, limit: number | null): number | null {
  if (limit === null) return null;
  if (limit <= 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function isAtLimit(used: number, limit: number | null): boolean {
  return limit !== null && used >= limit;
}

export function formatAmount(key: LimitKey, value: number): string {
  if (LIMIT_LABELS[key].unit === "count") return value.toLocaleString("en-US");
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export type UsageRow = { key: LimitKey; label: string; hint: string; used: number; limit: number | null; percent: number | null; usedText: string; limitText: string; atLimit: boolean; nearLimit: boolean };

export function buildUsageRows(limits: Limits, usage: Usage): UsageRow[] {
  return LIMIT_KEYS.map((key) => {
    const used = usage[key] ?? 0;
    const limit = limits[key] ?? null;
    const percent = percentUsed(used, limit);
    return {
      key,
      label: LIMIT_LABELS[key].label,
      hint: LIMIT_LABELS[key].hint,
      used,
      limit,
      percent,
      usedText: formatAmount(key, used),
      limitText: limit === null ? "no limit" : formatAmount(key, limit),
      atLimit: isAtLimit(used, limit),
      nearLimit: percent !== null && percent >= 80 && !isAtLimit(used, limit),
    };
  });
}

/** Parses what the database returns, ignoring anything unexpected. */
export function parseNumberMap(value: unknown): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  if (value && typeof value === "object") {
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      out[key] = typeof raw === "number" && Number.isFinite(raw) ? raw : raw === null ? null : typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : null;
    }
  }
  return out;
}

export const PLAN_LIMIT_MESSAGE = "You have reached the limit of your plan for this. Remove something you no longer need, or contact us to raise the limit.";
export const MONTHLY_AI_MESSAGE = "You have used all the AI posts in your plan for this month. The count resets at the start of next month, or contact us to raise the limit.";
