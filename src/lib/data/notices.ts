import "server-only";
import { adminDb } from "./platform";
import { DataError } from "./db";
import { DEFAULT_NOTICE, normalizeNotice, type SiteNotice } from "@/lib/notices";

const KEY = "site_notice";

export async function readNotice(): Promise<SiteNotice> {
  try {
    const { data } = await adminDb().from("platform_settings").select("value").eq("key", KEY).maybeSingle();
    return normalizeNotice((data as { value?: unknown } | null)?.value);
  } catch {
    return DEFAULT_NOTICE;
  }
}

export async function writeNotice(notice: SiteNotice, userId: string): Promise<void> {
  const { error } = await adminDb().from("platform_settings").upsert({ key: KEY, value: notice, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: "key" });
  if (error) throw new DataError("Could not save the notice settings.", error.code);
}
