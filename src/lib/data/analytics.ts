import "server-only";
import { adminDb } from "./platform";
import { DataError } from "./db";
import type { Bucket, Device, SourceKind } from "@/lib/analytics";

export type PageviewInsert = {
  path: string;
  referrer_host: string | null;
  source: SourceKind;
  source_name: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country: string | null;
  device: Device;
  browser: string;
  os: string;
  visitor_hash: string | null;
  session_id: string;
  is_entry: boolean;
};

/** The session this visitor was in during the last 30 minutes, if any. */
export async function findRecentSession(visitorHash: string, sinceIso: string): Promise<string | null> {
  const { data } = await adminDb().from("analytics_pageviews").select("session_id").eq("visitor_hash", visitorHash).gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as { session_id: string } | null)?.session_id ?? null;
}

export async function insertPageview(row: PageviewInsert): Promise<void> {
  const { error } = await adminDb().from("analytics_pageviews").insert(row);
  if (error) throw new DataError("Could not save the page view.", error.code);
}

export type NamedCount = { name: string; count: number; kind?: string };

export type AnalyticsReport = {
  online_now: number;
  totals: { pageviews: number; sessions: number; visitors: number; bounced_sessions: number; signups: number; payments: number; revenue: number };
  series: { t: string; views: number; visitors: number; sessions: number }[];
  pages: NamedCount[];
  entry_pages: NamedCount[];
  exit_pages: NamedCount[];
  sources: NamedCount[];
  source_kinds: NamedCount[];
  referrers: NamedCount[];
  countries: NamedCount[];
  devices: NamedCount[];
  browsers: NamedCount[];
  systems: NamedCount[];
  campaigns: NamedCount[];
  first_view_at: string | null;
};

export async function getReport(from: Date, to: Date, bucket: Bucket): Promise<AnalyticsReport> {
  const { data, error } = await adminDb().rpc("analytics_report", { p_from: from.toISOString(), p_to: to.toISOString(), p_bucket: bucket });
  if (error || !data) throw new DataError("Could not load the report.", error?.code);
  return data as AnalyticsReport;
}

/** The first day with data, to start the "All time" range there. */
export async function getFirstViewAt(): Promise<Date | null> {
  const { data } = await adminDb().from("analytics_pageviews").select("created_at").order("created_at", { ascending: true }).limit(1).maybeSingle();
  const at = (data as { created_at: string } | null)?.created_at;
  return at ? new Date(at) : null;
}

export async function cleanupOldViews(days: number): Promise<number> {
  const { data, error } = await adminDb().rpc("analytics_cleanup", { p_days: days });
  if (error) throw new DataError("Could not clean up old statistics.", error.code);
  return typeof data === "number" ? data : Number(data ?? 0);
}

export type AnalyticsSettings = { enabled: boolean; retentionDays: number };
const KEY = "analytics";
export const DEFAULT_ANALYTICS: AnalyticsSettings = { enabled: true, retentionDays: 400 };

export async function readAnalyticsSettings(): Promise<AnalyticsSettings> {
  try {
    const { data } = await adminDb().from("platform_settings").select("value").eq("key", KEY).maybeSingle();
    const v = (data as { value?: { enabled?: unknown; retentionDays?: unknown } } | null)?.value;
    const days = typeof v?.retentionDays === "number" && v.retentionDays >= 30 && v.retentionDays <= 3650 ? Math.round(v.retentionDays) : DEFAULT_ANALYTICS.retentionDays;
    return { enabled: v?.enabled === false ? false : true, retentionDays: days };
  } catch {
    return { ...DEFAULT_ANALYTICS };
  }
}

export async function writeAnalyticsSettings(settings: AnalyticsSettings, userId: string): Promise<void> {
  const { error } = await adminDb().from("platform_settings").upsert({ key: KEY, value: settings, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: "key" });
  if (error) throw new DataError("Could not save the analytics settings.", error.code);
}
