import "server-only";
import type { StockProviderKey } from "@/lib/media/image-search";
import { adminDb } from "./platform";
import { DataError } from "./db";

/**
 * Stock photo provider settings, saved by a platform admin in Admin -> Stock photos.
 * The API key is encrypted before it is stored (see lib/crypto/token-crypto.ts); it is never shown again.
 */
export type StockProviderSetting = { enabled: boolean; keyEncrypted: string | null };
export type StockSettings = Record<StockProviderKey, StockProviderSetting>;

export const STOCK_SETTINGS_KEY = "stock_photos";
/** The order in which results are mixed. Pexels is optional and last: it is only used when a key is added. */
export const STOCK_PROVIDER_KEYS: readonly StockProviderKey[] = ["pixabay", "unsplash", "pexels"];

const EMPTY = (): StockSettings => ({
  pexels: { enabled: false, keyEncrypted: null },
  pixabay: { enabled: false, keyEncrypted: null },
  unsplash: { enabled: false, keyEncrypted: null },
});

export async function readStockSettings(): Promise<StockSettings> {
  const settings = EMPTY();
  try {
    const { data, error } = await adminDb().from("platform_settings").select("value").eq("key", STOCK_SETTINGS_KEY).maybeSingle();
    if (error || !data) return settings;
    const value = (data as { value: Record<string, { enabled?: unknown; key?: unknown }> }).value ?? {};
    for (const key of STOCK_PROVIDER_KEYS) {
      const row = value[key];
      if (!row || typeof row !== "object") continue;
      settings[key] = { enabled: row.enabled === true, keyEncrypted: typeof row.key === "string" && row.key ? row.key : null };
    }
  } catch {
    // Settings are optional; without them the environment variables are used.
  }
  return settings;
}

export async function writeStockSettings(settings: StockSettings, userId: string): Promise<void> {
  const value: Record<string, { enabled: boolean; key: string | null }> = {};
  for (const key of STOCK_PROVIDER_KEYS) value[key] = { enabled: settings[key].enabled, key: settings[key].keyEncrypted };
  const { error } = await adminDb()
    .from("platform_settings")
    .upsert({ key: STOCK_SETTINGS_KEY, value, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: "key" });
  if (error) throw new DataError("Could not save the stock photo settings.", error.code);
}
