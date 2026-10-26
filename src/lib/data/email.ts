import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Db } from "./db";
import { DataError, unwrap } from "./db";

/** Email data. Writes use the service-role client (browsers have no access to the delivery log). */

function admin(): Db {
  return createAdminClient() as unknown as SupabaseClient;
}

export type EmailPrefs = { campaign_complete: boolean; publish_failures: boolean; page_alerts: boolean; suppressed: boolean };
export const DEFAULT_PREFS: EmailPrefs = { campaign_complete: true, publish_failures: true, page_alerts: true, suppressed: false };

export type EventStatus = "queued" | "sent" | "delivered" | "delayed" | "bounced" | "complained" | "failed" | "skipped";
export type EventRow = { id: string; template: string; status: EventStatus; error_code: string | null; created_at: string };

// ---------- Own preferences (signed-in user; row security applies) ----------

export async function getOwnPrefs(db: Db, userId: string): Promise<EmailPrefs> {
  const res = await db
    .from("email_preferences")
    .select("campaign_complete, publish_failures, page_alerts, suppressed")
    .eq("user_id", userId)
    .maybeSingle();
  return (unwrap(res, "load the email choices") as EmailPrefs | null) ?? DEFAULT_PREFS;
}

export async function saveOwnPrefs(db: Db, userId: string, prefs: Pick<EmailPrefs, "campaign_complete" | "publish_failures" | "page_alerts">): Promise<void> {
  const existing = await db.from("email_preferences").select("user_id").eq("user_id", userId).maybeSingle();
  const found = unwrap(existing, "load the email choices") as { user_id: string } | null;
  const res = found
    ? await db.from("email_preferences").update(prefs).eq("user_id", userId)
    : await db.from("email_preferences").insert({ user_id: userId, ...prefs });
  unwrap(res, "save the email choices");
}

// ---------- Sending side (service role) ----------

export async function getPrefs(userId: string): Promise<EmailPrefs> {
  const res = await admin()
    .from("email_preferences")
    .select("campaign_complete, publish_failures, page_alerts, suppressed")
    .eq("user_id", userId)
    .maybeSingle();
  return (unwrap(res, "load the email choices") as EmailPrefs | null) ?? DEFAULT_PREFS;
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await admin().auth.admin.getUserById(userId);
  if (error) return null;
  return data.user?.email ?? null;
}

export async function getUserName(userId: string): Promise<string | null> {
  const res = await admin().from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return (unwrap(res, "load the profile") as { display_name: string | null } | null)?.display_name ?? null;
}

/** Owners and admins of a workspace (at most 3), who get operational notices. */
export async function listWorkspaceAdminIds(ws: string): Promise<string[]> {
  const res = await admin().from("workspace_members").select("user_id").eq("workspace_id", ws).in("role", ["owner", "admin"]).limit(3);
  return ((unwrap(res, "load the members") ?? []) as { user_id: string }[]).map((r) => r.user_id);
}

/** Returns the new event id, or null when the same notice was already recorded (never send twice). */
export async function insertEvent(args: {
  workspaceId: string | null;
  userId: string;
  template: string;
  dedupeKey: string;
  status: EventStatus;
  errorCode?: string | null;
}): Promise<string | null> {
  const res = await admin()
    .from("email_events")
    .insert({
      workspace_id: args.workspaceId,
      user_id: args.userId,
      template: args.template,
      dedupe_key: args.dedupeKey.slice(0, 200),
      status: args.status,
      error_code: args.errorCode ?? null,
    })
    .select("id")
    .single();
  if (res.error) {
    if (res.error.code === "23505") return null;
    throw new DataError("Could not record the email.", res.error.code);
  }
  return (res.data as { id: string }).id;
}

export async function updateEvent(id: string, patch: { status: EventStatus; providerMessageId?: string | null; errorCode?: string | null }): Promise<void> {
  unwrap(
    await admin()
      .from("email_events")
      .update({ status: patch.status, provider_message_id: patch.providerMessageId ?? null, error_code: patch.errorCode ?? null })
      .eq("id", id),
    "update the email record",
  );
}

const RANK: Record<EventStatus, number> = { queued: 0, skipped: 0, failed: 1, sent: 1, delayed: 2, delivered: 3, bounced: 4, complained: 4 };

/** Applies a delivery update from the provider. Later news never gets overwritten by earlier news. Returns the user id. */
export async function applyDeliveryStatus(providerMessageId: string, status: EventStatus): Promise<{ userId: string | null } | null> {
  const db = admin();
  const found = unwrap(
    await db.from("email_events").select("id, user_id, status").eq("provider_message_id", providerMessageId).maybeSingle(),
    "find the email record",
  ) as { id: string; user_id: string | null; status: EventStatus } | null;
  if (!found) return null;
  if (RANK[status] >= RANK[found.status]) {
    unwrap(await db.from("email_events").update({ status }).eq("id", found.id), "update the email record");
  }
  return { userId: found.user_id };
}

/** After a bounce or complaint: stop sending to this person. */
export async function suppressUser(userId: string): Promise<void> {
  unwrap(await admin().from("email_preferences").upsert({ user_id: userId, suppressed: true }, { onConflict: "user_id" }), "suppress the address");
}

// ---------- Admin screen (platform admin; row security applies) ----------

export async function listRecentEvents(db: Db, limit = 20): Promise<EventRow[]> {
  const res = await db.from("email_events").select("id, template, status, error_code, created_at").order("created_at", { ascending: false }).limit(limit);
  return (unwrap(res, "load the email log") ?? []) as EventRow[];
}
