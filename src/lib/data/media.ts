import "server-only";
import type { Db } from "./db";
import { DataError, unwrap } from "./db";

export const MEDIA_BUCKET = "media";

/** Postgres codes the media functions use on purpose. */
export const PG_LIBRARY_FULL = "53400";

export type MediaAttribution = {
  provider?: string;
  creator?: string;
  creator_url?: string;
  source_page_url?: string;
  license?: string;
  license_url?: string;
  credit_text?: string;
};

export type MediaAssetRow = {
  id: string;
  workspace_id: string;
  storage_path: string | null;
  source_url: string | null;
  attribution: MediaAttribution;
  alt_text: string | null;
  mime_type: string | null;
  byte_size: number | null;
  width: number | null;
  height: number | null;
  processing_status: "pending" | "ready" | "failed";
  created_at: string;
};

const COLUMNS = "id, workspace_id, storage_path, source_url, attribution, alt_text, mime_type, byte_size, width, height, processing_status, created_at";

export async function listMediaAssets(db: Db, ws: string, limit = 100): Promise<MediaAssetRow[]> {
  const res = await db.from("media_assets").select(COLUMNS).eq("workspace_id", ws).order("created_at", { ascending: false }).limit(limit);
  return (unwrap(res, "load the media library") ?? []) as MediaAssetRow[];
}

export async function getMediaAsset(db: Db, ws: string, id: string): Promise<MediaAssetRow | null> {
  const res = await db.from("media_assets").select(COLUMNS).eq("workspace_id", ws).eq("id", id).maybeSingle();
  return unwrap(res, "load the image") as MediaAssetRow | null;
}

export async function getMediaAssets(db: Db, ws: string, ids: string[]): Promise<MediaAssetRow[]> {
  if (ids.length === 0) return [];
  const res = await db.from("media_assets").select(COLUMNS).eq("workspace_id", ws).in("id", ids);
  return (unwrap(res, "load the images") ?? []) as MediaAssetRow[];
}

export async function registerMediaAsset(
  db: Db,
  args: {
    workspaceId: string;
    storagePath: string;
    sourceUrl: string | null;
    attribution: MediaAttribution;
    altText: string | null;
    mimeType: string;
    byteSize: number;
    width: number;
    height: number;
  },
): Promise<string> {
  const { data, error } = await db.rpc("register_media_asset", {
    p_workspace_id: args.workspaceId,
    p_storage_path: args.storagePath,
    p_source_url: args.sourceUrl,
    p_attribution: args.attribution,
    p_alt_text: args.altText,
    p_mime_type: args.mimeType,
    p_byte_size: args.byteSize,
    p_width: args.width,
    p_height: args.height,
  });
  if (error || typeof data !== "string") throw new DataError("Could not save the image.", error?.code);
  return data;
}

export async function updateMediaMeta(
  db: Db,
  ws: string,
  id: string,
  patch: { altText: string | null; attribution: MediaAttribution },
): Promise<void> {
  const res = await db
    .from("media_assets")
    .update({ alt_text: patch.altText, attribution: patch.attribution })
    .eq("workspace_id", ws)
    .eq("id", id)
    .select("id");
  const rows = (unwrap(res, "update the image") as unknown[] | null) ?? [];
  if (rows.length === 0) throw new DataError("Could not update the image.", "P0002");
}

export async function deleteMediaRow(db: Db, ws: string, id: string): Promise<void> {
  const res = await db.from("media_assets").delete().eq("workspace_id", ws).eq("id", id).select("id");
  const rows = (unwrap(res, "delete the image") as unknown[] | null) ?? [];
  if (rows.length === 0) throw new DataError("Could not delete the image.", "P0002");
}

// ---------- Storage (private bucket, always through the signed-in user's session) ----------

export async function uploadObject(db: Db, path: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType, upsert: false, cacheControl: "3600" });
  if (error) throw new DataError("Could not upload the image.");
}

export async function removeObjects(db: Db, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await db.storage.from(MEDIA_BUCKET).remove(paths);
  if (error) throw new DataError("Could not remove the image file.");
}

/** Short-lived links (default 10 minutes) so images are never public. Missing files are skipped. */
export async function signedUrls(db: Db, paths: string[], seconds = 600): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  const { data, error } = await db.storage.from(MEDIA_BUCKET).createSignedUrls(paths, seconds);
  if (error || !data) return urls;
  for (const entry of data) {
    if (entry.path && entry.signedUrl && !entry.error) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}

// ---------- Links between posts and images ----------

export async function listItemMediaIds(db: Db, ws: string, itemId: string): Promise<string[]> {
  const res = await db
    .from("content_item_media")
    .select("media_asset_id, sort_order")
    .eq("workspace_id", ws)
    .eq("content_item_id", itemId)
    .order("sort_order", { ascending: true });
  return ((unwrap(res, "load the post image") ?? []) as { media_asset_id: string }[]).map((r) => r.media_asset_id);
}

export async function removeItemMedia(db: Db, ws: string, itemId: string): Promise<void> {
  const res = await db.from("content_item_media").delete().eq("workspace_id", ws).eq("content_item_id", itemId);
  unwrap(res, "remove the post image");
}

export async function addItemMedia(db: Db, ws: string, itemId: string, mediaId: string): Promise<void> {
  const res = await db
    .from("content_item_media")
    .insert({ workspace_id: ws, content_item_id: itemId, media_asset_id: mediaId, sort_order: 0 });
  unwrap(res, "attach the image");
}

export async function countItemsUsingMedia(db: Db, ws: string, mediaId: string): Promise<number> {
  const { count, error } = await db
    .from("content_item_media")
    .select("content_item_id", { count: "exact", head: true })
    .eq("workspace_id", ws)
    .eq("media_asset_id", mediaId);
  if (error) throw new DataError("Could not check where the image is used.");
  return count ?? 0;
}

// ---------- Usage (stock searches and imports) ----------

export async function countRecentUsage(db: Db, ws: string, userId: string, sinceIso: string, actionType: string): Promise<number> {
  const { count, error } = await db
    .from("usage_records")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ws)
    .eq("user_id", userId)
    .eq("action_type", actionType)
    .gte("created_at", sinceIso);
  if (error) throw new DataError("Could not check usage.");
  return count ?? 0;
}
