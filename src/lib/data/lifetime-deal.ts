import "server-only";
import { adminDb } from "./platform";
import { DataError } from "./db";
import { DEFAULT_DEAL, normalizeDeal, type LifetimeDeal } from "@/lib/lifetime-deal";

const KEY = "lifetime_deal";

export async function readLifetimeDeal(): Promise<LifetimeDeal> {
  try {
    const { data, error } = await adminDb().from("platform_settings").select("value").eq("key", KEY).maybeSingle();
    if (error || !data) return { ...DEFAULT_DEAL };
    return normalizeDeal((data as { value: unknown }).value);
  } catch {
    return { ...DEFAULT_DEAL };
  }
}

export async function writeLifetimeDeal(deal: LifetimeDeal, userId: string | null): Promise<void> {
  const { error } = await adminDb().from("platform_settings").upsert({ key: KEY, value: deal, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: "key" });
  if (error) throw new DataError("Could not save the lifetime deal.", error.code);
}

/** Stops selling lifetime access on every plan. Returns how many plans were switched off. */
export async function closeLifetimeSales(): Promise<number> {
  const { data, error } = await adminDb().from("plans").update({ lifetime_available: false }).eq("lifetime_available", true).select("key");
  if (error) throw new DataError("Could not close the lifetime sales.", error.code);
  return (data ?? []).length;
}
