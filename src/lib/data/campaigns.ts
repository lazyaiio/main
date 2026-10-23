import "server-only";
import type { Db } from "./db";
import { DataError, unwrap } from "./db";
import type { CampaignDetail, CampaignSlotRow } from "./types";

/** Postgres error codes the campaign functions use on purpose. */
export const PG_NOT_ALLOWED = "42501";
export const PG_NOT_FOUND = "P0002";
export const PG_INVALID = "22023";
export const PG_UNIQUE_VIOLATION = "23505";

function rpcFailure(error: { code?: string }, what: string): DataError {
  return new DataError(`Could not ${what}.`, error.code);
}

export async function getCampaign(db: Db, ws: string, id: string): Promise<CampaignDetail | null> {
  const res = await db.from("campaigns").select("*").eq("workspace_id", ws).eq("id", id).maybeSingle();
  return unwrap(res, "load the campaign") as CampaignDetail | null;
}

export async function listCampaignSlots(db: Db, ws: string, campaignId: string): Promise<CampaignSlotRow[]> {
  const res = await db
    .from("campaign_slots")
    .select("id, workspace_id, campaign_id, slot_index, planned_at, language, content_format, theme, status, attempts, last_error_code, content_item_id")
    .eq("workspace_id", ws)
    .eq("campaign_id", campaignId)
    .order("slot_index", { ascending: true })
    .limit(90);
  return (unwrap(res, "load the campaign plan") ?? []) as CampaignSlotRow[];
}

/** Posts already written for the campaign (for the near-duplicate check). */
export async function listCampaignPostTexts(
  db: Db,
  ws: string,
  campaignId: string,
): Promise<{ id: string; hook: string | null; body: string }[]> {
  const res = await db
    .from("content_items")
    .select("id, hook, body")
    .eq("workspace_id", ws)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true })
    .limit(200);
  return (unwrap(res, "load the campaign posts") ?? []) as { id: string; hook: string | null; body: string }[];
}

export async function createCampaignWithSlots(
  db: Db,
  args: {
    workspaceId: string;
    projectId: string;
    name: string;
    durationDays: number;
    languages: string[];
    brief: Record<string, string>;
    slots: unknown[];
  },
): Promise<string> {
  const { data, error } = await db.rpc("create_campaign_with_slots", {
    p_workspace_id: args.workspaceId,
    p_project_id: args.projectId,
    p_name: args.name,
    p_duration_days: args.durationDays,
    p_languages: args.languages,
    p_brief: args.brief,
    p_slots: args.slots,
  });
  if (error || typeof data !== "string") throw rpcFailure(error ?? {}, "create the campaign");
  return data;
}

async function simpleRpc(db: Db, name: string, campaignId: string, what: string): Promise<void> {
  const { error } = await db.rpc(name, { p_campaign_id: campaignId });
  if (error) throw rpcFailure(error, what);
}

export const startCampaignRpc = (db: Db, id: string) => simpleRpc(db, "start_campaign", id, "start the campaign");
export const pauseCampaignRpc = (db: Db, id: string) => simpleRpc(db, "pause_campaign", id, "pause the campaign");
export const cancelCampaignRpc = (db: Db, id: string) => simpleRpc(db, "cancel_campaign", id, "cancel the campaign");

export async function retryFailedSlotsRpc(db: Db, id: string): Promise<number> {
  const { data, error } = await db.rpc("retry_failed_slots", { p_campaign_id: id });
  if (error) throw rpcFailure(error, "retry the failed posts");
  return typeof data === "number" ? data : 0;
}

export async function claimSlotsRpc(db: Db, campaignId: string, limit: number, leaseSeconds: number): Promise<CampaignSlotRow[]> {
  const { data, error } = await db.rpc("claim_campaign_slots", {
    p_campaign_id: campaignId,
    p_limit: limit,
    p_lease_seconds: leaseSeconds,
  });
  if (error) throw rpcFailure(error, "start the next posts");
  return (Array.isArray(data) ? data : []) as CampaignSlotRow[];
}

export async function completeSlotRpc(db: Db, slotId: string, itemId: string): Promise<boolean> {
  const { data, error } = await db.rpc("complete_campaign_slot", { p_slot_id: slotId, p_content_item_id: itemId });
  if (error) throw rpcFailure(error, "finish the post");
  return data === true;
}

export async function releaseSlotRpc(
  db: Db,
  slotId: string,
  code: string,
  options: { retry: boolean; refund: boolean },
): Promise<void> {
  const { error } = await db.rpc("release_campaign_slot", {
    p_slot_id: slotId,
    p_error_code: code,
    p_retry: options.retry,
    p_refund: options.refund,
  });
  if (error) throw rpcFailure(error, "update the post");
}

/** Moves every draft post of the campaign to "needs review". Returns how many moved. */
export async function submitCampaignDrafts(db: Db, ws: string, campaignId: string): Promise<number> {
  const res = await db
    .from("content_items")
    .update({ approval_status: "awaiting_approval" })
    .eq("workspace_id", ws)
    .eq("campaign_id", campaignId)
    .eq("approval_status", "draft")
    .select("id");
  return ((unwrap(res, "submit the posts") as unknown[] | null) ?? []).length;
}

export async function countCampaignPostsByStatus(db: Db, ws: string, campaignId: string): Promise<Record<string, number>> {
  const res = await db.from("content_items").select("approval_status").eq("workspace_id", ws).eq("campaign_id", campaignId).limit(200);
  const rows = (unwrap(res, "count the posts") ?? []) as { approval_status: string }[];
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.approval_status] = (counts[row.approval_status] ?? 0) + 1;
  return counts;
}
