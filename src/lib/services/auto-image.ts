import "server-only";
import { addItemMedia, countRecentUsage, uploadObject, removeObjects } from "@/lib/data/media";
import { adminDb } from "@/lib/data/platform";
import { downloadImage, StockSearchError, type StockPhoto } from "@/lib/media/image-search";
import { inspectImage } from "@/lib/media/image-inspect";
import { MAX_UPLOAD_BYTES } from "@/lib/media/limits";
import { buildMediaPath } from "@/lib/media/paths";
import { loadStockProviders, searchStock } from "@/lib/media/stock-providers";
import { pickPhoto, stockQueryCandidates } from "@/lib/media/stock-query";
import { makeThumbnail } from "@/lib/media/thumbnail";

/** Stock searches the background writer may make per workspace per hour (the provider key is shared). */
const SEARCHES_PER_WORKSPACE_PER_HOUR = 40;

export type AutoImageResult = "attached" | "skipped" | "none_found" | "failed";

/** Photos of this workspace that came from a stock provider: never use the same photo twice. */
async function usedPages(workspaceId: string): Promise<Set<string>> {
  const { data } = await adminDb().from("media_assets").select("source_url").eq("workspace_id", workspaceId).not("source_url", "is", null).limit(500);
  return new Set(((data ?? []) as { source_url: string | null }[]).map((r) => r.source_url).filter((u): u is string => Boolean(u)));
}

/**
 * Finds a stock photo for a finished post and attaches it. Runs on the server with the service role (the
 * background writer has no signed-in person). It never throws: a post without a photo is still a good post.
 */
export async function attachAutoImage(args: {
  workspaceId: string;
  userId: string | null;
  itemId: string;
  imageBrief: string | null;
  topic: string | null;
}): Promise<AutoImageResult> {
  const db = adminDb();
  try {
    const providers = await loadStockProviders();
    if (providers.length === 0) return "skipped";

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const used = args.userId ? await countRecentUsage(db, args.workspaceId, args.userId, since, "image.search") : 0;
    if (used >= SEARCHES_PER_WORKSPACE_PER_HOUR) return "skipped";

    const taken = await usedPages(args.workspaceId);
    let photo: StockPhoto | null = null;
    let providerId = "";
    for (const query of stockQueryCandidates(args.imageBrief, args.topic)) {
      const results = await searchStock(providers, query, 15);
      photo = pickPhoto(results, taken);
      if (photo) {
        providerId = photo.providerKey;
        break;
      }
    }
    if (args.userId) {
      await db.from("usage_records").insert({ workspace_id: args.workspaceId, user_id: args.userId, action_type: "image.search", provider: providerId || "stock", model: "auto", units: 1 });
    }
    if (!photo) return "none_found";

    const provider = providers.find((p) => p.id === photo!.providerKey);
    if (!provider) return "failed";
    const bytes = await downloadImage(photo.downloadUrl, { allowedHosts: provider.allowedHosts, maxBytes: MAX_UPLOAD_BYTES });
    const info = inspectImage(bytes);
    if (!info.ok) return "failed";

    const path = buildMediaPath(args.workspaceId, crypto.randomUUID(), info.ext);
    await uploadObject(db, path, bytes, info.mime);
    let thumbPath: string | null = null;
    try {
      const thumb = await makeThumbnail(bytes);
      thumbPath = buildMediaPath(args.workspaceId, crypto.randomUUID(), "webp");
      await uploadObject(db, thumbPath, thumb.bytes, "image/webp");
    } catch {
      thumbPath = null;
    }

    const { data, error } = await db.rpc("system_register_media_asset", {
      p_workspace_id: args.workspaceId,
      p_storage_path: path,
      p_thumb_path: thumbPath,
      p_source_url: photo.sourcePageUrl,
      p_attribution: {
        provider: photo.providerName,
        creator: photo.creator,
        creator_url: photo.creatorUrl || undefined,
        source_page_url: photo.sourcePageUrl,
        license: photo.license,
        license_url: photo.licenseUrl,
        credit_text: `Photo by ${photo.creator} on ${photo.providerName}`,
      },
      p_alt_text: photo.alt || null,
      p_mime_type: info.mime,
      p_byte_size: bytes.length,
      p_width: info.width,
      p_height: info.height,
      p_created_by: args.userId,
    });
    if (error || typeof data !== "string") {
      await removeObjects(db, thumbPath ? [path, thumbPath] : [path]).catch(() => undefined);
      return "failed";
    }
    await addItemMedia(db, args.workspaceId, args.itemId, data);
    await provider.trackDownload?.(photo);
    return "attached";
  } catch (error) {
    if (error instanceof StockSearchError) return "failed";
    return "failed";
  }
}
