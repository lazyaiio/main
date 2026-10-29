import "server-only";
import type { StockProviderKey } from "./image-search";

/**
 * The only place that reads stock photo keys from the environment (the fallback when no key was saved in
 * Admin -> Stock photos). Accepts the older IMAGE_PROVIDER + IMAGE_PROVIDER_API_KEY pair, or PEXELS_API_KEY /
 * PIXABAY_API_KEY / UNSPLASH_ACCESS_KEY.
 */
export function getEnvStockKey(key: StockProviderKey): string | null {
  const text = (v: string | undefined) => (v ?? "").trim();
  const legacy = text(process.env.IMAGE_PROVIDER).toLowerCase() === key ? text(process.env.IMAGE_PROVIDER_API_KEY) : "";
  const named =
    key === "pexels" ? text(process.env.PEXELS_API_KEY) : key === "pixabay" ? text(process.env.PIXABAY_API_KEY) : text(process.env.UNSPLASH_ACCESS_KEY);
  return legacy || named || null;
}
