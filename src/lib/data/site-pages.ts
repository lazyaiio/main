import "server-only";
import { adminDb } from "./platform";
import { DataError } from "./db";

export type SitePageRow = { slug: string; title: string; intro: string; body: string; data: Record<string, unknown> | null; updated_at: string };
export type SitePageVersion = { id: number; title: string; intro: string; body: string; data: Record<string, unknown> | null; saved_at: string };

const COLUMNS = "slug, title, intro, body, data, updated_at";
const KEEP_VERSIONS = 10;

/** The saved version of a page, or null (also when the table does not exist yet): the site then shows its built-in text. */
export async function getSitePage(slug: string): Promise<SitePageRow | null> {
  try {
    const { data, error } = await adminDb().from("site_pages").select(COLUMNS).eq("slug", slug).maybeSingle();
    return error ? null : (data as SitePageRow | null);
  } catch {
    return null;
  }
}

export async function saveSitePage(
  slug: string,
  fields: { title: string; intro: string; body: string; data?: Record<string, unknown> | null },
  userId: string,
): Promise<void> {
  const db = adminDb();
  const now = new Date().toISOString();
  const row = { slug, title: fields.title.trim(), intro: fields.intro.trim(), body: fields.body.replace(/\r\n?/g, "\n"), data: fields.data ?? null, updated_at: now, updated_by: userId };
  const { error } = await db.from("site_pages").upsert(row, { onConflict: "slug" });
  if (error) throw new DataError("Could not save the page.", error.code);

  // Keep the last few saved versions so a mistake can be undone.
  await db.from("site_page_versions").insert({ slug, title: row.title, intro: row.intro, body: row.body, data: row.data, saved_at: now, saved_by: userId });
  const { data: old } = await db.from("site_page_versions").select("id").eq("slug", slug).order("saved_at", { ascending: false }).range(KEEP_VERSIONS, KEEP_VERSIONS + 200);
  const ids = ((old ?? []) as { id: number }[]).map((r) => r.id);
  if (ids.length > 0) await db.from("site_page_versions").delete().in("id", ids);
}

/** Goes back to the built-in text. Saved versions are kept. */
export async function resetSitePage(slug: string): Promise<void> {
  const { error } = await adminDb().from("site_pages").delete().eq("slug", slug);
  if (error) throw new DataError("Could not reset the page.", error.code);
}

export async function listPageVersions(slug: string): Promise<SitePageVersion[]> {
  try {
    const { data } = await adminDb().from("site_page_versions").select("id, title, intro, body, data, saved_at").eq("slug", slug).order("saved_at", { ascending: false }).limit(KEEP_VERSIONS);
    return (data ?? []) as SitePageVersion[];
  } catch {
    return [];
  }
}

export async function getPageVersion(slug: string, id: number): Promise<SitePageVersion | null> {
  try {
    const { data } = await adminDb().from("site_page_versions").select("id, title, intro, body, data, saved_at").eq("slug", slug).eq("id", id).maybeSingle();
    return (data as SitePageVersion | null) ?? null;
  } catch {
    return null;
  }
}
