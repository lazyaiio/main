import "server-only";
import { decryptToken } from "@/lib/crypto/token-crypto";
import { readStockSettings, STOCK_PROVIDER_KEYS } from "@/lib/data/stock-settings";
import { getEnvStockKey } from "./keys";
import { getTokenEncryptionKey } from "@/lib/social/keys";
import {
  StockSearchError,
  createPexelsProvider,
  createPixabayProvider,
  createUnsplashProvider,
  type ImageSearchProvider,
  type StockPhoto,
  type StockProviderKey,
} from "./image-search";

/** Encryption context for a stored key: a value copied to another provider fails to decrypt. */
export const stockKeyContext = (key: StockProviderKey) => `stock:${key}`;

export type StockKeySource = "admin" | "environment" | "none";

function build(key: StockProviderKey, apiKey: string): ImageSearchProvider {
  return key === "pexels" ? createPexelsProvider(apiKey) : key === "pixabay" ? createPixabayProvider(apiKey) : createUnsplashProvider(apiKey);
}

export type StockProviderStatus = { key: StockProviderKey; enabled: boolean; source: StockKeySource };

/** What the admin page shows. Never includes a key. */
export async function getStockStatus(): Promise<StockProviderStatus[]> {
  const settings = await readStockSettings();
  return STOCK_PROVIDER_KEYS.map((key) => {
    const stored = settings[key];
    const source: StockKeySource = stored.keyEncrypted ? "admin" : getEnvStockKey(key) ? "environment" : "none";
    // A key from the environment is always on. To turn a provider off, remove its environment variable.
    const enabled = source === "admin" ? stored.enabled : source === "environment";
    return { key, enabled, source };
  });
}

/** Providers that are on and have a working key, in order (Pexels first). */
export async function loadStockProviders(): Promise<ImageSearchProvider[]> {
  const settings = await readStockSettings();
  const secret = getTokenEncryptionKey();
  const providers: ImageSearchProvider[] = [];
  for (const key of STOCK_PROVIDER_KEYS) {
    const stored = settings[key];
    let apiKey: string | null = null;
    if (stored.keyEncrypted) {
      if (!stored.enabled || !secret) continue;
      try {
        apiKey = decryptToken(secret, stockKeyContext(key), stored.keyEncrypted);
      } catch {
        apiKey = null;
      }
    } else {
      apiKey = getEnvStockKey(key);
    }
    if (apiKey) providers.push(build(key, apiKey));
  }
  return providers;
}

export async function hasStockProvider(): Promise<boolean> {
  return (await loadStockProviders()).length > 0;
}

/**
 * Searches every provider at the same time and mixes the results (one from each in turn), so a person or a
 * campaign sees photos from all of them. A provider that fails is skipped; it only throws when all fail.
 */
export async function searchStock(providers: ImageSearchProvider[], query: string, perPage = 12): Promise<StockPhoto[]> {
  const settled = await Promise.allSettled(providers.map((p) => p.search(query, { perPage })));
  const lists: StockPhoto[][] = [];
  let lastError: unknown = null;
  for (const result of settled) {
    if (result.status === "fulfilled") lists.push(result.value);
    else lastError = result.reason;
  }
  if (lists.length === 0 && lastError instanceof StockSearchError) throw lastError;
  const mixed: StockPhoto[] = [];
  for (let i = 0; mixed.length < lists.reduce((n, l) => n + l.length, 0); i++) {
    for (const list of lists) if (list[i]) mixed.push(list[i] as StockPhoto);
  }
  return mixed;
}
