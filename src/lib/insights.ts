import { z } from "zod";

/**
 * Facebook Page Insights (pure: no database, no network).
 * The metric names are the ones Meta's Graph API reference (v26) lists as current. Meta retired a number of Page Insights
 * metrics on June 15, 2026, so every metric is requested on its own and a metric Facebook refuses is shown as unavailable
 * instead of breaking the page.
 */

export const INSIGHTS_SCOPE = "read_insights";
export const INSIGHT_RANGES = [7, 28] as const;
export type RangeDays = (typeof INSIGHT_RANGES)[number];
export const isRange = (n: number): n is RangeDays => (INSIGHT_RANGES as readonly number[]).includes(n);
export const MAX_POSTS_SHOWN = 8;

export type PageMetricKey = "views" | "viewers" | "engagements" | "profile_views" | "new_followers" | "actions";
export type PostMetricKey = "views" | "viewers" | "clicks" | "reactions";

export const PAGE_METRICS: { key: PageMetricKey; graph: string; label: string; help: string }[] = [
  { key: "views", graph: "page_media_view", label: "Views", help: "How many times your content was played or displayed: posts, videos, stories, and ads." },
  { key: "viewers", graph: "page_total_media_view_unique", label: "People reached", help: "The number of different people who saw your content. Facebook says this is an estimate." },
  { key: "engagements", graph: "page_post_engagements", label: "Post engagements", help: "Reactions, comments, shares, and more on your posts." },
  { key: "profile_views", graph: "page_views_total", label: "Page visits", help: "How many times your Page's profile was viewed." },
  { key: "new_followers", graph: "page_daily_follows_unique", label: "New followers", help: "New people who followed your Page. Facebook says this is an estimate." },
  { key: "actions", graph: "page_total_actions", label: "Button and contact clicks", help: "Clicks on your Page's contact details and call-to-action button." },
];

export const POST_METRICS: { key: PostMetricKey; graph: string; label: string }[] = [
  { key: "views", graph: "post_media_view", label: "Views" },
  { key: "viewers", graph: "post_total_media_view_unique", label: "People reached" },
  { key: "clicks", graph: "post_clicks", label: "Clicks" },
  { key: "reactions", graph: "post_reactions_by_type_total", label: "Reactions" },
];

// ---------- Time windows ----------

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The window to ask Facebook for: twice the range, so the previous period can be compared. Ends at the start of today (UTC). */
export function insightsWindow(rangeDays: RangeDays, now: Date = new Date()): { since: Date; until: Date; currentFrom: string; currentTo: string } {
  const untilMs = Math.floor(now.getTime() / DAY) * DAY;
  return {
    since: new Date(untilMs - rangeDays * 2 * DAY),
    until: new Date(untilMs),
    currentFrom: isoDay(untilMs - rangeDays * DAY),
    currentTo: isoDay(untilMs - DAY),
  };
}

// ---------- Reading Facebook's answers ----------

export type Point = { date: string; value: number };

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    let sum = 0;
    let any = false;
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        sum += v;
        any = true;
      }
    }
    return any ? sum : null;
  }
  return null;
}

const insightsBody = z.object({ data: z.array(z.object({ name: z.string().optional(), values: z.array(z.object({ value: z.unknown(), end_time: z.string().optional() })).default([]) })) });

/**
 * Daily points from an insights answer. A value's end_time is the END of the day it describes, so the day is one before it.
 * Returns null when the answer is not an insights answer; an empty list means Facebook sent no data.
 */
export function parseDailyPoints(body: unknown): Point[] | null {
  const parsed = insightsBody.safeParse(body);
  if (!parsed.success) return null;
  const series = parsed.data.data[0];
  if (!series) return [];
  const points: Point[] = [];
  for (const v of series.values) {
    const value = numeric(v.value);
    const end = v.end_time ? new Date(v.end_time).getTime() : Number.NaN;
    if (value === null || Number.isNaN(end)) continue;
    points.push({ date: isoDay(end - DAY), value });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** One lifetime number per metric from a post insights answer (many metrics may come in one answer). */
export function parseLifetimeValues(body: unknown): Record<string, number> {
  const parsed = insightsBody.safeParse(body);
  const out: Record<string, number> = {};
  if (!parsed.success) return out;
  for (const item of parsed.data.data) {
    const last = item.values[item.values.length - 1];
    const value = last ? numeric(last.value) : null;
    if (item.name && value !== null) out[item.name] = value;
  }
  return out;
}

// ---------- Summaries ----------

export type MetricSummary = { total: number; previousTotal: number | null; changePct: number | null; points: Point[] };

/** Totals for the current range and the range before it, plus the change. Missing days count as 0 only when Facebook sent some data. */
export function summarize(points: Point[], rangeDays: RangeDays, now: Date = new Date()): MetricSummary {
  const w = insightsWindow(rangeDays, now);
  const current = points.filter((p) => p.date >= w.currentFrom && p.date <= w.currentTo);
  const previous = points.filter((p) => p.date < w.currentFrom);
  const total = current.reduce((s, p) => s + p.value, 0);
  const previousTotal = previous.length > 0 ? previous.reduce((s, p) => s + p.value, 0) : null;
  const changePct = previousTotal !== null && previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : null;
  return { total, previousTotal, changePct, points: current };
}

/** Fills missing days with 0 so a chart has one bar per day. */
export function fillDays(points: Point[], from: string, to: string): Point[] {
  const byDay = new Map(points.map((p) => [p.date, p.value]));
  const out: Point[] = [];
  for (let ms = new Date(`${from}T00:00:00Z`).getTime(); ms <= new Date(`${to}T00:00:00Z`).getTime(); ms += DAY) out.push({ date: isoDay(ms), value: byDay.get(isoDay(ms)) ?? 0 });
  return out;
}

export function changeText(changePct: number | null): string | null {
  if (changePct === null) return null;
  if (changePct === 0) return "No change";
  return `${changePct > 0 ? "+" : ""}${changePct}%`;
}

export const formatCount = (n: number): string => Math.round(n).toLocaleString("en-US");

/** The first line of a post, as its title in the list. */
export function postTitle(hook: string | null, body: string): string {
  const source = (hook && hook.trim()) || body;
  const line = source.replace(/\s+/g, " ").trim();
  return line.length > 90 ? `${line.slice(0, 89).trimEnd()}…` : line || "Untitled post";
}

// ---------- What is stored ----------

export const metricProblem = z.enum(["unavailable", "no_data", "permission", "rate_limited", "temporary"]);
export type MetricProblem = z.infer<typeof metricProblem>;

const num = z.number().finite();
export const snapshotSchema = z.object({
  rangeDays: z.union([z.literal(7), z.literal(28)]),
  currentFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currentTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  page: z.object({ followers: num.nullable(), likes: num.nullable() }),
  metrics: z
    .array(
      z.object({
        key: z.string().max(40),
        total: num.nullable(),
        previousTotal: num.nullable(),
        changePct: num.nullable(),
        points: z.array(z.object({ date: z.string().max(10), value: num })).max(31),
        problem: metricProblem.nullable(),
      }),
    )
    .max(12),
  posts: z
    .array(
      z.object({
        scheduledPostId: z.string().max(60),
        title: z.string().max(120),
        publishedAt: z.string().max(40),
        views: num.nullable(),
        viewers: num.nullable(),
        clicks: num.nullable(),
        reactions: num.nullable(),
        problem: metricProblem.nullable(),
      }),
    )
    .max(20),
});
export type InsightsSnapshot = z.infer<typeof snapshotSchema>;

export function describeMetricProblem(problem: MetricProblem): string {
  switch (problem) {
    case "unavailable":
      return "Facebook no longer offers this number.";
    case "no_data":
      return "Facebook sent no data for this number.";
    case "permission":
      return "Facebook did not allow this number. The person who connected the Page may need the Analyze role.";
    case "rate_limited":
      return "Facebook asked us to slow down. Try again in a few minutes.";
    case "temporary":
      return "Facebook had a temporary problem. Try again in a few minutes.";
  }
}

export type InsightsAccess =
  | { state: "ready" }
  | { state: "not_enabled" } // the site owner has not switched Insights on yet
  | { state: "needs_reconnect" } // this connection was made before the Insights permission was requested or granted
  | { state: "page_not_connected" };

/** Decides whether Insights can be fetched for a Page right now. */
export function insightsAccess(input: { featureOn: boolean; pageConnected: boolean; grantedScopes: string[] }): InsightsAccess {
  if (!input.pageConnected) return { state: "page_not_connected" };
  if (!input.featureOn) return { state: "not_enabled" };
  if (!input.grantedScopes.includes(INSIGHTS_SCOPE)) return { state: "needs_reconnect" };
  return { state: "ready" };
}

/** Facebook updates most numbers about once a day, so asking more often than this just wastes calls. */
export const REFRESH_COOLDOWN_MINUTES = 30;
export function canRefresh(fetchedAt: string | null, now: Date = new Date()): boolean {
  if (!fetchedAt) return true;
  const t = new Date(fetchedAt).getTime();
  return Number.isNaN(t) || now.getTime() - t >= REFRESH_COOLDOWN_MINUTES * 60_000;
}
