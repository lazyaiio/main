import "server-only";
import { adminDb } from "./platform";
import { DataError } from "./db";
import { DEFAULT_SEO, EMPTY_OVERRIDE, normalizeSeo, type PageSeoOverride, type SeoSettings } from "@/lib/seo";

const KEY = "seo";

export async function readSeoSettings(): Promise<SeoSettings> {
  try {
    const { data } = await adminDb().from("platform_settings").select("value").eq("key", KEY).maybeSingle();
    return normalizeSeo((data as { value?: unknown } | null)?.value);
  } catch {
    return { ...DEFAULT_SEO };
  }
}

export async function writeSeoSettings(settings: SeoSettings, userId: string): Promise<void> {
  const { error } = await adminDb().from("platform_settings").upsert({ key: KEY, value: settings, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: "key" });
  if (error) throw new DataError("Could not save the SEO settings.", error.code);
}

export async function readPageOverrides(): Promise<Record<string, PageSeoOverride>> {
  try {
    const { data } = await adminDb().from("seo_pages").select("path, title, description, og_image, noindex").limit(100);
    const out: Record<string, PageSeoOverride> = {};
    for (const row of (data ?? []) as { path: string; title: string; description: string; og_image: string; noindex: boolean }[]) {
      out[row.path] = { title: row.title, description: row.description, ogImage: row.og_image, noindex: row.noindex };
    }
    return out;
  } catch {
    return {};
  }
}

export async function savePageOverride(path: string, value: PageSeoOverride, userId: string): Promise<void> {
  const same = value.title === EMPTY_OVERRIDE.title && value.description === "" && value.ogImage === "" && !value.noindex;
  const db = adminDb();
  if (same) {
    const { error } = await db.from("seo_pages").delete().eq("path", path);
    if (error) throw new DataError("Could not reset the page.", error.code);
    return;
  }
  const { error } = await db.from("seo_pages").upsert({ path, title: value.title, description: value.description, og_image: value.ogImage, noindex: value.noindex, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: "path" });
  if (error) throw new DataError("Could not save the page.", error.code);
}

/** When each editable page was last saved in Admin -> Pages (for the sitemap's last-modified dates). */
export async function readPageDates(): Promise<Record<string, string>> {
  try {
    const { data } = await adminDb().from("site_pages").select("slug, updated_at").limit(50);
    const out: Record<string, string> = {};
    for (const row of (data ?? []) as { slug: string; updated_at: string }[]) out[row.slug] = row.updated_at;
    return out;
  } catch {
    return {};
  }
}
