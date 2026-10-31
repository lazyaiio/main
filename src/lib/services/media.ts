import "server-only";
import { canWrite } from "@/lib/auth/permissions";
import type { AppContext } from "@/lib/auth/session";
import { recordAiUsage } from "@/lib/data/ai-settings";
import { getContentItem } from "@/lib/data/content";
import { DataError, getDb, type Db } from "@/lib/data/db";
import {
  PG_LIBRARY_FULL,
  addItemMedia,
  countRecentUsage,
  deleteMediaRow,
  getMediaAsset,
  getMediaAssets,
  listItemMediaIds,
  listMediaAssets,
  registerMediaAsset,
  removeItemMedia,
  removeObjects,
  setMediaThumbnail,
  signedUrls,
  downloadObject,
  updateMediaMeta,
  uploadObject,
  type MediaAssetRow,
  type MediaAttribution,
} from "@/lib/data/media";
import { StockSearchError, cleanQuery, downloadImage, type StockPhoto } from "@/lib/media/image-search";
import { inspectImage, type InspectResult } from "@/lib/media/image-inspect";
import { loadStockProviders, searchStock } from "@/lib/media/stock-providers";
import { MAX_UPLOAD_BYTES, STOCK_IMPORTS_PER_HOUR, STOCK_SEARCHES_PER_HOUR } from "@/lib/media/limits";
import { buildMediaPath } from "@/lib/media/paths";
import { makeThumbnail } from "@/lib/media/thumbnail";
import { logAudit } from "./audit";
import { ServiceError } from "./errors";
import { enforceRate } from "./plans";

function requireWrite(ctx: AppContext) {
  if (!ctx.emailVerified) throw new ServiceError("forbidden", "Please verify your email first. We sent you a link.");
  if (!canWrite(ctx.role)) throw new ServiceError("forbidden", "You do not have permission to do that.");
}

const NOT_FOUND = () => new ServiceError("not_found", "That image could not be found.");

/** url = the full-size image, thumbUrl = the small preview (falls back to the full image for older uploads). */
export type MediaItem = MediaAssetRow & { url: string | null; thumbUrl: string | null };

/** Is stock photo search turned on, and which provider credit must be shown? */
export async function getStockProviderInfo(): Promise<{ providers: { name: string; creditUrl: string }[] } | null> {
  const providers = await loadStockProviders();
  return providers.length > 0 ? { providers: providers.map((p) => ({ name: p.name, creditUrl: p.creditUrl })) } : null;
}

async function withUrls(db: Db, assets: MediaAssetRow[]): Promise<MediaItem[]> {
  const paths = assets.flatMap((a) => [a.storage_path, a.thumb_path]).filter((p): p is string => Boolean(p));
  const urls = await signedUrls(db, paths);
  return assets.map((a) => {
    const url = a.storage_path ? (urls.get(a.storage_path) ?? null) : null;
    const thumbUrl = a.thumb_path ? (urls.get(a.thumb_path) ?? null) : null;
    return { ...a, url, thumbUrl: thumbUrl ?? url };
  });
}

export async function listLibrary(ctx: AppContext): Promise<{ items: MediaItem[]; totalBytes: number }> {
  const db = await getDb();
  const assets = await listMediaAssets(db, ctx.workspace.id, 100);
  const items = await withUrls(db, assets);
  return { items, totalBytes: assets.reduce((sum, a) => sum + (a.byte_size ?? 0), 0) };
}

/**
 * Creates and stores the small preview. Never blocks the upload: if it fails, the image is saved
 * without a thumbnail and the library shows the full image (a later "create thumbnails" run fixes it).
 */
async function storeThumbnail(ctx: AppContext, db: Db, bytes: Uint8Array): Promise<string | null> {
  try {
    const thumb = await makeThumbnail(bytes);
    const thumbPath = buildMediaPath(ctx.workspace.id, crypto.randomUUID(), "webp");
    await uploadObject(db, thumbPath, thumb.bytes, "image/webp");
    return thumbPath;
  } catch {
    return null;
  }
}

/** Saves checked image bytes: file first, then the library entry. Cleans up the file if the entry fails. */
async function saveImage(
  ctx: AppContext,
  db: Db,
  bytes: Uint8Array,
  info: Extract<InspectResult, { ok: true }>,
  meta: { sourceUrl: string | null; attribution: MediaAttribution; altText: string | null; auditAction: string },
): Promise<string> {
  const path = buildMediaPath(ctx.workspace.id, crypto.randomUUID(), info.ext);
  try {
    await uploadObject(db, path, bytes, info.mime);
  } catch {
    throw new ServiceError("failed", "The image could not be uploaded. Please try again.");
  }
  const thumbPath = await storeThumbnail(ctx, db, bytes);
  let id: string;
  try {
    id = await registerMediaAsset(db, {
      workspaceId: ctx.workspace.id,
      storagePath: path,
      thumbPath,
      sourceUrl: meta.sourceUrl,
      attribution: meta.attribution,
      altText: meta.altText,
      mimeType: info.mime,
      byteSize: bytes.length,
      width: info.width,
      height: info.height,
    });
  } catch (error) {
    try {
      await removeObjects(db, thumbPath ? [path, thumbPath] : [path]);
    } catch {
      // The stray file is harmless (private, unlisted) and can be cleaned up later.
    }
    if (error instanceof DataError && error.code === PG_LIBRARY_FULL) {
      throw new ServiceError("library_full", "Your media library is full. Delete some images to add more.");
    }
    if (error instanceof DataError && error.code === "42501") throw new ServiceError("forbidden", "You do not have permission to do that.");
    throw new ServiceError("failed", "The image could not be saved. Please try again.");
  }
  await logAudit(db, ctx, meta.auditAction, "media_asset", id, { bytes: bytes.length, width: info.width, height: info.height });
  return id;
}

export async function uploadImage(
  ctx: AppContext,
  file: File,
  input: { altText?: string; credit?: string },
): Promise<string> {
  requireWrite(ctx);
  if (!(file instanceof File) || file.size === 0) throw new ServiceError("invalid", "Choose an image to upload.");
  if (file.size > MAX_UPLOAD_BYTES) throw new ServiceError("invalid", "That image is larger than 4 MB. Choose a smaller file.");

  const db = await getDb();
  await enforceRate(db, "media_upload", 30, 3600); // decoding and resizing images is the costly part

  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = inspectImage(bytes, { fileName: file.name, declaredType: file.type });
  if (!info.ok) throw new ServiceError("invalid", info.message);

  const attribution: MediaAttribution = input.credit ? { credit_text: input.credit } : {};
  return saveImage(ctx, db, bytes, info, {
    sourceUrl: null,
    attribution,
    altText: input.altText || null,
    auditAction: "media.uploaded",
  });
}

export async function updateMedia(ctx: AppContext, id: string, input: { altText: string | null; credit: string | null }): Promise<void> {
  requireWrite(ctx);
  const db = await getDb();
  const asset = await getMediaAsset(db, ctx.workspace.id, id);
  if (!asset) throw NOT_FOUND();
  const attribution: MediaAttribution = { ...asset.attribution };
  if (input.credit) attribution.credit_text = input.credit;
  else delete attribution.credit_text;
  try {
    await updateMediaMeta(db, ctx.workspace.id, id, { altText: input.altText, attribution });
  } catch {
    throw NOT_FOUND();
  }
  await logAudit(db, ctx, "media.updated", "media_asset", id, {});
}

export async function deleteMedia(ctx: AppContext, id: string): Promise<void> {
  requireWrite(ctx);
  const db = await getDb();
  const asset = await getMediaAsset(db, ctx.workspace.id, id);
  if (!asset) throw NOT_FOUND();
  try {
    await deleteMediaRow(db, ctx.workspace.id, id);
  } catch {
    throw NOT_FOUND();
  }
  const files = [asset.storage_path, asset.thumb_path].filter((p): p is string => Boolean(p));
  if (files.length > 0) {
    try {
      await removeObjects(db, files);
    } catch {
      // The library entry is gone; an unlisted private file may remain until cleanup.
    }
  }
  await logAudit(db, ctx, "media.deleted", "media_asset", id, {});
}

// ---------------------------------------------------------------------------------------------
// Stock photos
// ---------------------------------------------------------------------------------------------

async function enforceStockLimit(db: Db, ctx: AppContext, actionType: "image.search" | "image.import", limit: number) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const used = await countRecentUsage(db, ctx.workspace.id, ctx.user.id, since, actionType);
  if (used >= limit) {
    throw new ServiceError("stock_limited", "You have reached the hourly stock photo limit. Please try again later.");
  }
}

async function recordStockUsage(db: Db, ctx: AppContext, actionType: "image.search" | "image.import", provider: string) {
  try {
    await recordAiUsage(db, { workspaceId: ctx.workspace.id, actionType, provider, model: actionType === "image.search" ? "search" : "import", units: 1 });
  } catch {
    // A missed usage record must not block the user.
  }
}

function stockError(error: unknown): never {
  if (error instanceof StockSearchError) {
    throw new ServiceError(error.code === "rate_limited" ? "stock_limited" : "stock_failed", error.message);
  }
  throw error;
}

export async function searchStockPhotos(ctx: AppContext, rawQuery: string): Promise<StockPhoto[]> {
  requireWrite(ctx);
  const providers = await loadStockProviders();
  const provider = providers[0];
  if (!provider) throw new ServiceError("stock_failed", "Stock photo search is not set up yet.");
  const query = cleanQuery(rawQuery);
  if (!query) throw new ServiceError("invalid", "Enter at least 2 characters to search.");

  const db = await getDb();
  await enforceStockLimit(db, ctx, "image.search", STOCK_SEARCHES_PER_HOUR);
  await recordStockUsage(db, ctx, "image.search", provider.id); // counted even if the call fails: it protects the shared key
  try {
    return await searchStock(providers, query, 12);
  } catch (error) {
    return stockError(error);
  }
}

/**
 * Copies one stock photo into the library. The photo is looked up again by its id on the server, so
 * the browser can never choose what gets downloaded.
 */
export async function importStockPhoto(ctx: AppContext, photoRef: string): Promise<string> {
  requireWrite(ctx);
  // The reference looks like "pexels:123" or "pixabay:456".
  const [providerKey, providerPhotoId] = photoRef.split(":");
  const provider = (await loadStockProviders()).find((p) => p.id === providerKey);
  if (!provider || !providerPhotoId) throw new ServiceError("stock_failed", "Stock photo search is not set up yet.");

  const db = await getDb();
  await enforceStockLimit(db, ctx, "image.import", STOCK_IMPORTS_PER_HOUR);
  await recordStockUsage(db, ctx, "image.import", provider.id);

  let photo: StockPhoto | null;
  let bytes: Uint8Array;
  try {
    photo = await provider.getById(providerPhotoId);
    if (!photo) throw new ServiceError("not_found", "That photo could not be found.");
    bytes = await downloadImage(photo.downloadUrl, { allowedHosts: provider.allowedHosts, maxBytes: MAX_UPLOAD_BYTES });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    return stockError(error);
  }

  const info = inspectImage(bytes);
  if (!info.ok) throw new ServiceError("invalid", info.message);

  const saved = await saveImage(ctx, db, bytes, info, {
    sourceUrl: photo.sourcePageUrl,
    attribution: {
      provider: photo.providerName,
      creator: photo.creator,
      creator_url: photo.creatorUrl || undefined,
      source_page_url: photo.sourcePageUrl,
      license: photo.license,
      license_url: photo.licenseUrl,
      credit_text: `Photo by ${photo.creator} on ${photo.providerName}`,
    },
    altText: photo.alt || null,
    auditAction: "media.imported",
  });
  await provider.trackDownload?.(photo);
  return saved;
}

// ---------------------------------------------------------------------------------------------
// Images on posts (one image per post for now)
// ---------------------------------------------------------------------------------------------

/** The image attached to a post, with a short-lived link, or null. */
export async function getPostImage(ctx: AppContext, itemId: string): Promise<MediaItem | null> {
  const db = await getDb();
  const ids = await listItemMediaIds(db, ctx.workspace.id, itemId);
  if (ids.length === 0) return null;
  const assets = await getMediaAssets(db, ctx.workspace.id, ids.slice(0, 1));
  const [item] = await withUrls(db, assets);
  return item ?? null;
}

export async function attachImage(ctx: AppContext, itemId: string, mediaId: string): Promise<void> {
  requireWrite(ctx);
  const db = await getDb();
  const item = await getContentItem(db, ctx.workspace.id, itemId);
  if (!item) throw new ServiceError("not_found", "That post could not be found.");
  const asset = await getMediaAsset(db, ctx.workspace.id, mediaId);
  if (!asset || asset.processing_status !== "ready") throw NOT_FOUND();

  try {
    await removeItemMedia(db, ctx.workspace.id, itemId);
    await addItemMedia(db, ctx.workspace.id, itemId, mediaId);
  } catch {
    throw new ServiceError("failed", "Something went wrong. Please try again.");
  }
  await logAudit(db, ctx, "content.image_attached", "content_item", itemId, { media_id: mediaId });
}

export async function detachImage(ctx: AppContext, itemId: string): Promise<void> {
  requireWrite(ctx);
  const db = await getDb();
  const item = await getContentItem(db, ctx.workspace.id, itemId);
  if (!item) throw new ServiceError("not_found", "That post could not be found.");
  try {
    await removeItemMedia(db, ctx.workspace.id, itemId);
  } catch {
    throw new ServiceError("failed", "Something went wrong. Please try again.");
  }
  await logAudit(db, ctx, "content.image_removed", "content_item", itemId, {});
}

// ---------------------------------------------------------------------------------------------
// Thumbnails for images uploaded before thumbnails existed
// ---------------------------------------------------------------------------------------------

/** Creates thumbnails for up to 8 older images per run (keeps each request short). Returns how many are left. */
export async function createMissingThumbnails(ctx: AppContext): Promise<{ created: number; remaining: number }> {
  requireWrite(ctx);
  const db = await getDb();
  await enforceRate(db, "media_thumbnails", 20, 3600);
  const assets = await listMediaAssets(db, ctx.workspace.id, 100);
  const missing = assets.filter((a) => a.storage_path && !a.thumb_path && a.processing_status === "ready");

  let created = 0;
  for (const asset of missing.slice(0, 8)) {
    try {
      const original = await downloadObject(db, asset.storage_path as string);
      const thumb = await makeThumbnail(original);
      const thumbPath = buildMediaPath(ctx.workspace.id, crypto.randomUUID(), "webp");
      await uploadObject(db, thumbPath, thumb.bytes, "image/webp");
      try {
        await setMediaThumbnail(db, asset.id, thumbPath);
        created++;
      } catch {
        await removeObjects(db, [thumbPath]).catch(() => undefined);
      }
    } catch {
      // Skip this image; it keeps working with its full-size preview.
    }
  }
  return { created, remaining: Math.max(0, missing.length - created) };
}

export function countMissingThumbnails(items: MediaItem[]): number {
  return items.filter((a) => a.storage_path && !a.thumb_path).length;
}
