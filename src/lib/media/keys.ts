import "server-only";
import { createPexelsProvider, type ImageSearchProvider } from "./image-search";

/**
 * The only place that reads stock photo settings from the environment.
 * IMAGE_PROVIDER=pexels plus IMAGE_PROVIDER_API_KEY turns stock search on; otherwise it stays off.
 */
export function getImageProvider(): ImageSearchProvider | null {
  const name = (process.env.IMAGE_PROVIDER ?? "").trim().toLowerCase();
  if (name !== "pexels") return null;
  const key = (process.env.IMAGE_PROVIDER_API_KEY ?? "").trim();
  return key ? createPexelsProvider(key) : null;
}
