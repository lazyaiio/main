import "server-only";
import type { Db } from "./db";
import { DataError, unwrap } from "./db";
import type { PostStatus } from "./types";

export type ScheduleRow = {
  id: string;
  workspace_id: string;
  content_item_id: string;
  social_page_id: string;
  scheduled_at: string;
  status: PostStatus;
  attempt_count: number;
  last_error: string | null;
  published_at: string | null;
  next_attempt_at: string | null;
};

const COLUMNS = "id, workspace_id, content_item_id, social_page_id, scheduled_at, status, attempt_count, last_error, published_at, next_attempt_at";

export async function listSchedulesForItem(db: Db, ws: string, itemId: string): Promise<ScheduleRow[]> {
  const res = await db
    .from("scheduled_posts")
    .select(COLUMNS)
    .eq("workspace_id", ws)
    .eq("content_item_id", itemId)
    .order("scheduled_at", { ascending: false })
    .limit(20);
  return (unwrap(res, "load the schedule") ?? []) as ScheduleRow[];
}

/** The message text comes from our own database functions (short fixed phrases), never from user input. */
function failure(error: { code?: string; message?: string }): DataError {
  const own = error.code === "42501" || error.code === "22023" || error.code === "P0002" || error.code === "23505";
  return new DataError(own ? (error.message ?? "").slice(0, 60) : "Could not update the schedule.", error.code);
}

export async function schedulePostRpc(db: Db, args: { workspaceId: string; itemId: string; pageId: string; at: Date }): Promise<string> {
  const { data, error } = await db.rpc("schedule_post", {
    p_workspace_id: args.workspaceId,
    p_content_item_id: args.itemId,
    p_social_page_id: args.pageId,
    p_scheduled_at: args.at.toISOString(),
  });
  if (error || typeof data !== "string") throw failure(error ?? {});
  return data;
}

async function call(db: Db, name: string, params: Record<string, unknown>): Promise<void> {
  const { error } = await db.rpc(name, params);
  if (error) throw failure(error);
}

export const reschedulePostRpc = (db: Db, id: string, at: Date) => call(db, "reschedule_post", { p_post_id: id, p_scheduled_at: at.toISOString() });
export const cancelScheduledPostRpc = (db: Db, id: string) => call(db, "cancel_scheduled_post", { p_post_id: id });
export const retryFailedPostRpc = (db: Db, id: string) => call(db, "retry_failed_post", { p_post_id: id });
export const markPostPublishedRpc = (db: Db, id: string) => call(db, "mark_post_published_manually", { p_post_id: id });

/** Posts waiting for a Page that is being disconnected must not be left behind. (Service role.) */
export async function getScheduleWorkspace(db: Db, id: string): Promise<{ workspace_id: string; content_item_id: string } | null> {
  const res = await db.from("scheduled_posts").select("workspace_id, content_item_id").eq("id", id).maybeSingle();
  return unwrap(res, "load the schedule") as { workspace_id: string; content_item_id: string } | null;
}
