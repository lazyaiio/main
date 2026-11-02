import "server-only";
import { adminDb } from "@/lib/data/platform";
import { getImageRows, insertImage, removeUnusedImageFiles } from "@/lib/data/blog";
import { downloadImage, type StockPhoto } from "@/lib/media/image-search";
import { inspectImage } from "@/lib/media/image-inspect";
import { MAX_UPLOAD_BYTES } from "@/lib/media/limits";
import { loadStockProviders, searchStock } from "@/lib/media/stock-providers";
import { pickPhoto, stockQueryCandidates } from "@/lib/media/stock-query";
import { makeThumbnail } from "@/lib/media/thumbnail";

/** Finds, downloads and saves one stock photo for the blog. Returns the new image id. */
export async function importStockPhotoForBlog(photo: StockPhoto): Promise<string> {
  const providers = await loadStockProviders();
  const provider = providers.find((p) => p.id === photo.providerKey);
  if (!provider) throw new Error("This photo provider is not set up.");
  const bytes = await downloadImage(photo.downloadUrl, { allowedHosts: provider.allowedHosts, maxBytes: MAX_UPLOAD_BYTES });
  const info = inspectImage(bytes);
  if (!info.ok) throw new Error("The photo could not be read.");
  if (info.mime === "image/gif") throw new Error("Animated pictures are not used in articles.");

  const db = adminDb();
  const stamp = crypto.randomUUID();
  const path = `${new Date().getUTCFullYear()}/${stamp}.${info.ext}`;
  const up = await db.storage.from("blog").upload(path, bytes, { contentType: info.mime, upsert: false, cacheControl: "31536000" });
  if (up.error) throw new Error("Could not store the photo.");
  let thumbPath: string | null = null;
  try {
    const thumb = await makeThumbnail(bytes);
    thumbPath = `${new Date().getUTCFullYear()}/${stamp}-thumb.webp`;
    const t = await db.storage.from("blog").upload(thumbPath, thumb.bytes, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
    if (t.error) thumbPath = null;
  } catch {
    thumbPath = null;
  }
  try {
    return await insertImage({
      storage_path: path,
      thumb_path: thumbPath,
      width: info.width,
      height: info.height,
      alt_text: photo.alt.slice(0, 300),
      provider: photo.providerName.slice(0, 40),
      creator: photo.creator.slice(0, 120),
      creator_url: photo.creatorUrl.slice(0, 300),
      source_page_url: photo.sourcePageUrl.slice(0, 400),
      license: photo.license.slice(0, 80),
      license_url: photo.licenseUrl.slice(0, 300),
    });
  } catch (error) {
    await removeUnusedImageFiles(thumbPath ? [path, thumbPath] : [path]).catch(() => undefined);
    throw error;
  } finally {
    await provider.trackDownload?.(photo);
  }
}

/** Searches every provider that is on. Throws a plain message when none is set up. */
export async function searchBlogPhotos(query: string, perPage = 18): Promise<StockPhoto[]> {
  const providers = await loadStockProviders();
  if (providers.length === 0) throw new Error("No stock photo provider is on. Add a Pixabay or Unsplash key in Admin, Stock photos.");
  return searchStock(providers, query.trim().slice(0, 120), perPage);
}

/** Picks a good photo for a search phrase: large, landscape, and not used by another article yet. */
export async function autoPhoto(query: string, extraTopic: string | null, used: Set<string>): Promise<StockPhoto | null> {
  const providers = await loadStockProviders();
  if (providers.length === 0) return null;
  for (const phrase of stockQueryCandidates(query, extraTopic)) {
    let results: StockPhoto[] = [];
    try {
      results = await searchStock(providers, phrase, 20);
    } catch {
      continue;
    }
    const photo = pickPhoto(results, used);
    if (photo) return photo;
  }
  return null;
}

export { getImageRows };
