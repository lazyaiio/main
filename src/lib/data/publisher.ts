import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Db } from "./db";
import { DataError, unwrap } from "./db";
import { MEDIA_BUCKET } from "./media";

/**
 * Everything the publishing dispatcher needs. There is no signed-in person here (it runs from the
 * scheduler), so all calls use the service-role client and always filter by workspace.
 */

function admin(): Db {
  return createAdminClient() as unknown as SupabaseClient;
}

export type ClaimedPost = {
  id: string;
  workspace_id: string;
  content_item_id: string;
  social_page_id: string;
  attempt_count: number;
};

export async function claimDuePosts(limit: number): Promise<ClaimedPost[]> {
  const { data, error } = await admin().rpc("claim_due_posts", { p_limit: limit, p_lease_seconds: 120 });
  if (error) throw new DataError("Could not claim the posts.", error.code);
  return (Array.isArray(data) ? data : []) as ClaimedPost[];
}

export async function finishPublished(id: string, providerPostId: string): Promise<boolean> {
  const { data, error } = await admin().rpc("finish_post_published", { p_post_id: id, p_provider_post_id: providerPostId });
  if (error) throw new DataError("Could not record the post.", error.code);
  return data === true;
}

export async function finishRetry(id: string, code: string, delaySeconds: number, maxAttempts: number): Promise<void> {
  const { error } = await admin().rpc("finish_post_retry", { p_post_id: id, p_error: code, p_delay_seconds: delaySeconds, p_max_attempts: maxAttempts });
  if (error) throw new DataError("Could not record the retry.", error.code);
}

export async function finishFailed(id: string, code: string): Promise<void> {
  const { error } = await admin().rpc("finish_post_failed", { p_post_id: id, p_error: code });
  if (error) throw new DataError("Could not record the failure.", error.code);
}

export async function releasePost(id: string): Promise<void> {
  const { error } = await admin().rpc("release_post", { p_post_id: id });
  if (error) throw new DataError("Could not release the post.", error.code);
}

export type PublishItem = {
  id: string;
  approval_status: string;
  body: string;
  cta: string | null;
  hashtags: string[];
};

export async function loadItem(ws: string, itemId: string): Promise<PublishItem | null> {
  const res = await admin()
    .from("content_items")
    .select("id, approval_status, body, cta, hashtags")
    .eq("workspace_id", ws)
    .eq("id", itemId)
    .maybeSingle();
  return unwrap(res, "load the post") as PublishItem | null;
}

export type PublishPage = {
  id: string;
  provider_page_id: string;
  social_account_id: string;
  status: string;
  capabilities: { can_publish?: boolean };
};

export async function loadPage(ws: string, pageId: string): Promise<PublishPage | null> {
  const res = await admin()
    .from("social_pages")
    .select("id, provider_page_id, social_account_id, status, capabilities")
    .eq("workspace_id", ws)
    .eq("id", pageId)
    .maybeSingle();
  return unwrap(res, "load the Page") as PublishPage | null;
}

/** The post's image (bytes and type), or null when the post has none. */
export async function loadImage(ws: string, itemId: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const db = admin();
  const link = unwrap(
    await db.from("content_item_media").select("media_asset_id").eq("workspace_id", ws).eq("content_item_id", itemId).order("sort_order", { ascending: true }).limit(1),
    "load the post image",
  ) as { media_asset_id: string }[] | null;
  const first = link?.[0];
  if (!first) return null;

  const asset = unwrap(
    await db.from("media_assets").select("storage_path, mime_type").eq("workspace_id", ws).eq("id", first.media_asset_id).maybeSingle(),
    "load the image",
  ) as { storage_path: string | null; mime_type: string | null } | null;
  if (!asset?.storage_path || !asset.mime_type) return null;

  const { data, error } = await db.storage.from(MEDIA_BUCKET).download(asset.storage_path);
  if (error || !data) throw new DataError("Could not read the image file.");
  return { bytes: new Uint8Array(await data.arrayBuffer()), mime: asset.mime_type };
}

/** Audit entries written by the system itself (no signed-in person). */
export async function writeSystemAudit(ws: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>): Promise<void> {
  await admin().from("audit_events").insert({ workspace_id: ws, actor_user_id: null, action, entity_type: entityType, entity_id: entityId, metadata });
}
