import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { snapshotSchema, type InsightsSnapshot, type RangeDays } from "@/lib/insights";
import type { Db } from "./db";
import { DataError, unwrap } from "./db";

/**
 * Saved Page Insights. READS use the signed-in person's session (row security: members of the workspace only).
 * WRITES use the service key, because browsers have no write access to this table.
 */

const admin = (): Db => createAdminClient() as unknown as SupabaseClient;

export type StoredSnapshot = { snapshot: InsightsSnapshot; fetchedAt: string };

/** The last saved numbers, or null when there are none yet (or the table does not exist yet). Stored data that no longer fits the shape is ignored. */
export async function getSnapshot(db: Db, ws: string, pageId: string, rangeDays: RangeDays): Promise<StoredSnapshot | null> {
  const { data, error } = await db.from("page_insight_snapshots").select("data, fetched_at").eq("workspace_id", ws).eq("social_page_id", pageId).eq("range_days", rangeDays).maybeSingle();
  if (error || !data) return null;
  const row = data as { data: unknown; fetched_at: string };
  const parsed = snapshotSchema.safeParse(row.data);
  return parsed.success ? { snapshot: parsed.data, fetchedAt: row.fetched_at } : null;
}

/** When each of this workspace's Pages was last refreshed, for the Page picker. */
export async function listSnapshotTimes(db: Db, ws: string): Promise<{ social_page_id: string; range_days: number; fetched_at: string }[]> {
  const { data, error } = await db.from("page_insight_snapshots").select("social_page_id, range_days, fetched_at").eq("workspace_id", ws);
  return error || !data ? [] : (data as { social_page_id: string; range_days: number; fetched_at: string }[]);
}

export async function saveSnapshot(ws: string, pageId: string, snapshot: InsightsSnapshot): Promise<void> {
  const { error } = await admin()
    .from("page_insight_snapshots")
    .upsert({ workspace_id: ws, social_page_id: pageId, range_days: snapshot.rangeDays, data: snapshot, fetched_at: new Date().toISOString() }, { onConflict: "workspace_id,social_page_id,range_days" });
  if (error) throw new DataError("Could not save the Insights. Check that migration 0025 was run.", error.code);
}

export type PublishedPost = { id: string; provider_post_id: string; published_at: string; title: string };

/** The Page's most recently published posts (last 90 days) that LazyAI sent, with their first line as a title. */
export async function listPublishedPosts(ws: string, pageId: string, limit: number): Promise<PublishedPost[]> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const posts = (unwrap(
    await admin()
      .from("scheduled_posts")
      .select("id, provider_post_id, published_at, content_item_id")
      .eq("workspace_id", ws)
      .eq("social_page_id", pageId)
      .eq("status", "published")
      .not("provider_post_id", "is", null)
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(limit),
    "read the published posts",
  ) ?? []) as { id: string; provider_post_id: string; published_at: string; content_item_id: string }[];
  if (posts.length === 0) return [];
  const items = (unwrap(await admin().from("content_items").select("id, hook, body").eq("workspace_id", ws).in("id", posts.map((p) => p.content_item_id)), "read the post texts") ?? []) as { id: string; hook: string | null; body: string }[];
  const byId = new Map(items.map((i) => [i.id, i]));
  return posts.map((p) => {
    const item = byId.get(p.content_item_id);
    const source = ((item?.hook && item.hook.trim()) || item?.body || "").replace(/\s+/g, " ").trim();
    return { id: p.id, provider_post_id: p.provider_post_id, published_at: p.published_at, title: source.length > 90 ? `${source.slice(0, 89).trimEnd()}…` : source || "Untitled post" };
  });
}
