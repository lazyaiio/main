import { z } from "zod";

/**
 * Stock photo search behind a small interface, so another provider can be added later.
 * The first adapter is Pexels (free API key, photos free for commercial use; see docs/MEDIA_PROVIDERS.md).
 *
 * Safety rules built in here:
 *  - the browser never sends a download address; the server looks the photo up again by its id,
 *  - downloads are only allowed from the provider's own image host, over HTTPS, with a size limit,
 *  - provider responses are validated before use.
 */

export type StockProviderKey = "pexels" | "pixabay" | "unsplash";

export type StockPhoto = {
  /** Unsplash asks apps to report each photo that is used, by calling this address. */
  trackingUrl?: string;
  /** Which provider the photo came from. */
  providerKey: StockProviderKey;
  providerId: string;
  providerName: string;
  sourcePageUrl: string;
  previewUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
  alt: string;
  creator: string;
  creatorUrl: string;
  license: string;
  licenseUrl: string;
};

export interface ImageSearchProvider {
  readonly id: StockProviderKey;
  readonly name: string;
  /** Link the search page must show (the provider asks for visible credit). */
  readonly creditUrl: string;
  readonly allowedHosts: readonly string[];
  search(query: string, options?: { page?: number; perPage?: number }): Promise<StockPhoto[]>;
  getById(id: string): Promise<StockPhoto | null>;
  /** Called after a photo was actually used (only Unsplash needs it). Never throws. */
  trackDownload?(photo: StockPhoto): Promise<void>;
}

export class StockSearchError extends Error {
  constructor(
    public readonly code: "unavailable" | "rate_limited" | "bad_response" | "download_failed" | "not_allowed",
    message: string,
  ) {
    super(message);
    this.name = "StockSearchError";
  }
}

/** Trims and limits a search phrase. Returns null when it is too short to search. */
export function cleanQuery(raw: string): string | null {
  const query = raw.replace(/\s+/g, " ").trim().slice(0, 100);
  return query.length >= 2 ? query : null;
}

function isHttpsOnHost(value: string, hosts: readonly string[]): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (url.port === "" || url.port === "443") && hosts.includes(url.hostname);
  } catch {
    return false;
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Pexels
// ---------------------------------------------------------------------------------------------

export const PEXELS_HOSTS = ["images.pexels.com"] as const;

const pexelsPhoto = z.object({
  id: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  url: z.string(),
  photographer: z.string().default("Unknown"),
  photographer_url: z.string().default(""),
  alt: z.string().nullish(),
  src: z.object({ large2x: z.string().optional(), large: z.string().optional(), medium: z.string().optional() }),
});
const pexelsSearch = z.object({ photos: z.array(pexelsPhoto) });

type PexelsPhoto = z.infer<typeof pexelsPhoto>;

function toStockPhoto(photo: PexelsPhoto): StockPhoto | null {
  const previewUrl = photo.src.medium ?? photo.src.large;
  const downloadUrl = photo.src.large2x ?? photo.src.large;
  if (!previewUrl || !downloadUrl) return null;
  if (!isHttpsOnHost(previewUrl, PEXELS_HOSTS) || !isHttpsOnHost(downloadUrl, PEXELS_HOSTS)) return null;
  if (!isHttpsUrl(photo.url)) return null;
  return {
    providerKey: "pexels",
    providerId: String(photo.id),
    providerName: "Pexels",
    sourcePageUrl: photo.url,
    previewUrl,
    downloadUrl,
    width: photo.width,
    height: photo.height,
    alt: (photo.alt ?? "").trim().slice(0, 500),
    creator: photo.photographer.trim().slice(0, 100) || "Unknown",
    creatorUrl: isHttpsUrl(photo.photographer_url) ? photo.photographer_url : "",
    license: "Pexels License",
    licenseUrl: "https://www.pexels.com/license/",
  };
}

export function createPexelsProvider(apiKey: string, fetchFn: typeof fetch = fetch): ImageSearchProvider {
  async function call(url: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchFn(url, {
        headers: { Authorization: apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      });
    } catch {
      throw new StockSearchError("unavailable", "Stock photo search is not reachable right now. Try again in a moment.");
    }
    if (response.status === 429) throw new StockSearchError("rate_limited", "Stock photo search is busy. Try again in a few minutes.");
    if (response.status === 404) return null;
    if (!response.ok) throw new StockSearchError("unavailable", "Stock photo search is not available right now. Try again later.");
    try {
      return await response.json();
    } catch {
      throw new StockSearchError("bad_response", "Stock photo search returned an unexpected answer.");
    }
  }

  return {
    id: "pexels",
    name: "Pexels",
    creditUrl: "https://www.pexels.com",
    allowedHosts: PEXELS_HOSTS,
    async search(query, options = {}) {
      const perPage = Math.min(Math.max(options.perPage ?? 12, 1), 30);
      const page = Math.min(Math.max(options.page ?? 1, 1), 5);
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;
      const json = await call(url);
      const parsed = pexelsSearch.safeParse(json);
      if (!parsed.success) throw new StockSearchError("bad_response", "Stock photo search returned an unexpected answer.");
      return parsed.data.photos.map(toStockPhoto).filter((p): p is StockPhoto => p !== null);
    },
    async getById(id) {
      if (!/^\d{1,12}$/.test(id)) return null;
      const json = await call(`https://api.pexels.com/v1/photos/${id}`);
      if (json === null) return null;
      const parsed = pexelsPhoto.safeParse(json);
      if (!parsed.success) throw new StockSearchError("bad_response", "Stock photo search returned an unexpected answer.");
      return toStockPhoto(parsed.data);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Pixabay
// ---------------------------------------------------------------------------------------------

export const PIXABAY_HOSTS = ["pixabay.com", "cdn.pixabay.com"] as const;

const pixabayHit = z.object({
  id: z.number().int().positive(),
  pageURL: z.string(),
  tags: z.string().default(""),
  previewURL: z.string().optional(),
  webformatURL: z.string().optional(),
  largeImageURL: z.string().optional(),
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
  user: z.string().default("Unknown"),
  user_id: z.number().int().optional(),
});
const pixabaySearch = z.object({ hits: z.array(pixabayHit) });
type PixabayHit = z.infer<typeof pixabayHit>;

function pixabayToStockPhoto(hit: PixabayHit): StockPhoto | null {
  const previewUrl = hit.webformatURL ?? hit.previewURL;
  const downloadUrl = hit.largeImageURL ?? hit.webformatURL;
  if (!previewUrl || !downloadUrl) return null;
  if (!isHttpsOnHost(previewUrl, PIXABAY_HOSTS) || !isHttpsOnHost(downloadUrl, PIXABAY_HOSTS)) return null;
  if (!isHttpsUrl(hit.pageURL)) return null;
  const creator = hit.user.trim().slice(0, 100) || "Unknown";
  return {
    providerKey: "pixabay",
    providerId: String(hit.id),
    providerName: "Pixabay",
    sourcePageUrl: hit.pageURL,
    previewUrl,
    downloadUrl,
    width: hit.imageWidth,
    height: hit.imageHeight,
    alt: hit.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6).join(", ").slice(0, 500),
    creator,
    creatorUrl: hit.user_id ? `https://pixabay.com/users/${encodeURIComponent(creator.replace(/\s+/g, "-"))}-${hit.user_id}/` : "",
    license: "Pixabay Content License",
    licenseUrl: "https://pixabay.com/service/license-summary/",
  };
}

export function createPixabayProvider(apiKey: string, fetchFn: typeof fetch = fetch): ImageSearchProvider {
  async function call(params: Record<string, string>): Promise<unknown> {
    const url = `https://pixabay.com/api/?${new URLSearchParams({ key: apiKey, ...params }).toString()}`;
    let response: Response;
    try {
      response = await fetchFn(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000), redirect: "error" });
    } catch {
      throw new StockSearchError("unavailable", "Stock photo search is not reachable right now. Try again in a moment.");
    }
    if (response.status === 429) throw new StockSearchError("rate_limited", "Stock photo search is busy. Try again in a few minutes.");
    if (!response.ok) throw new StockSearchError("unavailable", "Stock photo search is not available right now. Try again later.");
    try {
      return await response.json();
    } catch {
      throw new StockSearchError("bad_response", "Stock photo search returned an unexpected answer.");
    }
  }
  return {
    id: "pixabay",
    name: "Pixabay",
    creditUrl: "https://pixabay.com",
    allowedHosts: PIXABAY_HOSTS,
    async search(query, options = {}) {
      const perPage = Math.min(Math.max(options.perPage ?? 12, 3), 30);
      const page = Math.min(Math.max(options.page ?? 1, 1), 5);
      const json = await call({ q: query, image_type: "photo", safesearch: "true", per_page: String(perPage), page: String(page) });
      const parsed = pixabaySearch.safeParse(json);
      if (!parsed.success) throw new StockSearchError("bad_response", "Stock photo search returned an unexpected answer.");
      return parsed.data.hits.map(pixabayToStockPhoto).filter((p): p is StockPhoto => p !== null);
    },
    async getById(id) {
      if (!/^\d{1,12}$/.test(id)) return null;
      const json = await call({ id });
      const parsed = pixabaySearch.safeParse(json);
      if (!parsed.success) throw new StockSearchError("bad_response", "Stock photo search returned an unexpected answer.");
      const hit = parsed.data.hits[0];
      return hit ? pixabayToStockPhoto(hit) : null;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Unsplash
// ---------------------------------------------------------------------------------------------

export const UNSPLASH_HOSTS = ["images.unsplash.com"] as const;
const UNSPLASH_UTM = "utm_source=lazyai&utm_medium=referral";

const unsplashPhoto = z.object({
  id: z.string().min(1).max(40),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt_description: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  urls: z.object({ regular: z.string(), small: z.string() }),
  links: z.object({ html: z.string(), download_location: z.string().optional() }),
  user: z.object({ name: z.string().default("Unknown"), username: z.string().default(""), links: z.object({ html: z.string().optional() }).optional() }),
});
const unsplashSearch = z.object({ results: z.array(unsplashPhoto) });
type UnsplashPhoto = z.infer<typeof unsplashPhoto>;

const withUtm = (url: string) => `${url}${url.includes("?") ? "&" : "?"}${UNSPLASH_UTM}`;

function unsplashToStockPhoto(p: UnsplashPhoto): StockPhoto | null {
  if (!isHttpsOnHost(p.urls.regular, UNSPLASH_HOSTS) || !isHttpsOnHost(p.urls.small, UNSPLASH_HOSTS)) return null;
  if (!isHttpsUrl(p.links.html)) return null;
  const tracking = p.links.download_location && isHttpsOnHost(p.links.download_location, ["api.unsplash.com"]) ? p.links.download_location : undefined;
  const creatorHome = p.user.links?.html && isHttpsUrl(p.user.links.html) ? withUtm(p.user.links.html) : "";
  return {
    providerKey: "unsplash",
    providerId: p.id,
    providerName: "Unsplash",
    sourcePageUrl: withUtm(p.links.html),
    previewUrl: p.urls.small,
    downloadUrl: p.urls.regular,
    width: p.width,
    height: p.height,
    alt: (p.alt_description || p.description || "").slice(0, 500),
    creator: p.user.name.trim().slice(0, 100) || "Unknown",
    creatorUrl: creatorHome,
    license: "Unsplash License",
    licenseUrl: "https://unsplash.com/license",
    trackingUrl: tracking,
  };
}

export function createUnsplashProvider(accessKey: string, fetchFn: typeof fetch = fetch): ImageSearchProvider {
  const headers = { Accept: "application/json", "Accept-Version": "v1", Authorization: `Client-ID ${accessKey}` };
  async function call(url: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchFn(url, { headers, signal: AbortSignal.timeout(8000), redirect: "error" });
    } catch {
      throw new StockSearchError("unavailable", "Stock photo search is not reachable right now. Try again in a moment.");
    }
    // Unsplash answers 403 when the hourly limit of the key is used up.
    if (response.status === 429 || response.status === 403) throw new StockSearchError("rate_limited", "Stock photo search is busy. Try again in a few minutes.");
    if (!response.ok) throw new StockSearchError("unavailable", "Stock photo search is not available right now. Try again later.");
    try {
      return await response.json();
    } catch {
      throw new StockSearchError("bad_response", "Stock photo search returned an unexpected answer.");
    }
  }
  return {
    id: "unsplash",
    name: "Unsplash",
    creditUrl: withUtm("https://unsplash.com"),
    allowedHosts: UNSPLASH_HOSTS,
    async search(query, options = {}) {
      const perPage = Math.min(Math.max(options.perPage ?? 12, 3), 30);
      const page = Math.min(Math.max(options.page ?? 1, 1), 5);
      const params = new URLSearchParams({ query, per_page: String(perPage), page: String(page), content_filter: "high" });
      const parsed = unsplashSearch.safeParse(await call(`https://api.unsplash.com/search/photos?${params.toString()}`));
      if (!parsed.success) throw new StockSearchError("bad_response", "Stock photo search returned an unexpected answer.");
      return parsed.data.results.map(unsplashToStockPhoto).filter((p): p is StockPhoto => p !== null);
    },
    async getById(id) {
      if (!/^[A-Za-z0-9_-]{5,40}$/.test(id)) return null;
      const parsed = unsplashPhoto.safeParse(await call(`https://api.unsplash.com/photos/${id}`));
      return parsed.success ? unsplashToStockPhoto(parsed.data) : null;
    },
    async trackDownload(photo) {
      if (!photo.trackingUrl) return;
      try {
        await fetchFn(photo.trackingUrl, { headers, signal: AbortSignal.timeout(5000), redirect: "error" });
      } catch {
        // Reporting is best effort.
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Safe download
// ---------------------------------------------------------------------------------------------

/** Downloads an image from an allowed host only. Never follows redirects. */
export async function downloadImage(
  url: string,
  options: { allowedHosts: readonly string[]; maxBytes: number; timeoutMs?: number; fetchFn?: typeof fetch },
): Promise<Uint8Array> {
  if (!isHttpsOnHost(url, options.allowedHosts)) {
    throw new StockSearchError("not_allowed", "That image address is not allowed.");
  }
  const fetchFn = options.fetchFn ?? fetch;
  let response: Response;
  try {
    let current = url;
    // Redirects are followed by hand (at most 2) and only while they stay on the provider's own hosts.
    for (let hop = 0; ; hop++) {
      response = await fetchFn(current, {
        headers: { Accept: "image/*" },
        signal: AbortSignal.timeout(options.timeoutMs ?? 15000),
        redirect: "manual",
      });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        const next = new URL(location, current).href;
        if (hop >= 2 || !isHttpsOnHost(next, options.allowedHosts)) {
          throw new StockSearchError("not_allowed", "That image address is not allowed.");
        }
        current = next;
        continue;
      }
      break;
    }
  } catch (error) {
    if (error instanceof StockSearchError) throw error;
    throw new StockSearchError("download_failed", "The photo could not be downloaded. Try again.");
  }
  if (!response.ok) throw new StockSearchError("download_failed", "The photo could not be downloaded. Try again.");

  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > options.maxBytes) throw new StockSearchError("download_failed", "That photo is too large to import.");

  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.length > options.maxBytes) throw new StockSearchError("download_failed", "That photo is too large to import.");
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > options.maxBytes) {
        await reader.cancel();
        throw new StockSearchError("download_failed", "That photo is too large to import.");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof StockSearchError) throw error;
    throw new StockSearchError("download_failed", "The photo could not be downloaded. Try again.");
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
