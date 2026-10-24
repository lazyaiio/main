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

export type StockPhoto = {
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
  readonly id: string;
  readonly name: string;
  /** Link the search page must show (the provider asks for visible credit). */
  readonly creditUrl: string;
  readonly allowedHosts: readonly string[];
  search(query: string, options?: { page?: number; perPage?: number }): Promise<StockPhoto[]>;
  getById(id: string): Promise<StockPhoto | null>;
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
    response = await fetchFn(url, {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(options.timeoutMs ?? 15000),
      redirect: "error",
    });
  } catch {
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
