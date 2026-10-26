import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Db } from "./db";
import { DataError, unwrap } from "./db";

/** Site-wide settings: the live publishing switch, the scheduler heartbeat, and the queue overview. */

export function adminDb(): Db {
  return createAdminClient() as unknown as SupabaseClient;
}

/** The yes/no answer. Anyone signed in (and the service role) may ask; nothing else is revealed. */
export async function isLiveFlagOn(db: Db): Promise<boolean> {
  const { data, error } = await db.rpc("is_live_publishing_enabled");
  return !error && data === true;
}

export async function setLivePublishing(db: Db, enabled: boolean): Promise<void> {
  const { error } = await db.rpc("set_live_publishing", { p_enabled: enabled });
  if (error) throw new DataError("Could not change the publishing switch.", error.code);
}

export type PublishingOverview = {
  due_now: number;
  waiting: number;
  publishing: number;
  failed: number;
  published_24h: number;
  oldest_due_seconds: number;
};

export async function getPublishingOverview(db: Db): Promise<PublishingOverview | null> {
  const { data, error } = await db.rpc("publishing_overview");
  if (error || !data || typeof data !== "object") return null;
  return data as PublishingOverview;
}

export type Heartbeat = {
  at: string;
  claimed?: number;
  published?: number;
  retrying?: number;
  failed?: number;
  uncertain?: number;
  disabled?: boolean;
  live_switch?: boolean;
  configured?: boolean;
};

export async function getHeartbeat(db: Db): Promise<Heartbeat | null> {
  const res = await db.from("platform_settings").select("value").eq("key", "dispatcher_heartbeat").maybeSingle();
  const row = unwrap(res, "load the scheduler status") as { value: Heartbeat } | null;
  return row?.value?.at ? row.value : null;
}

/** Called by the scheduler endpoint after every run (service role). */
export async function recordDispatcherRun(summary: Record<string, number | boolean>): Promise<void> {
  const { error } = await adminDb().rpc("record_dispatcher_run", { p_summary: summary });
  if (error) throw new DataError("Could not record the run.", error.code);
}
