import "server-only";
import { listPlans } from "@/lib/data/plans";
import { adminDb } from "@/lib/data/platform";
import { DataError } from "@/lib/data/db";
import { EXPORT_EXCLUDES, EXPORT_INCLUDES, pickExportableSettings, stripSecrets, type SettingRow, type SettingsExport } from "@/lib/settings-export";

/** Reads every exportable table with the service key. Callers must be platform admins. */
async function rows(table: string, order: string, limit = 2000): Promise<unknown[]> {
  const { data, error } = await adminDb().from(table).select("*").order(order, { ascending: true }).limit(limit);
  if (error) throw new DataError(`Could not read ${table}.`, error.code);
  return (data ?? []) as unknown[];
}

export async function buildSettingsExport(): Promise<SettingsExport> {
  const [settings, plans, sitePages, seoPages, categories, posts] = await Promise.all([
    rows("platform_settings", "key"),
    listPlans(adminDb()),
    rows("site_pages", "slug"),
    rows("seo_pages", "path"),
    rows("blog_categories", "sort_order"),
    rows("blog_posts", "created_at"),
  ]);
  return {
    app: "LazyAI",
    kind: "site-settings",
    version: 1,
    exportedAt: new Date().toISOString(),
    includes: EXPORT_INCLUDES,
    excludes: EXPORT_EXCLUDES,
    platformSettings: pickExportableSettings(settings as SettingRow[]),
    plans: plans.map((p) => stripSecrets(p)) as unknown[],
    sitePages: sitePages.map((r) => stripSecrets(r)) as unknown[],
    seoPages: seoPages.map((r) => stripSecrets(r)) as unknown[],
    blog: { categories: categories.map((r) => stripSecrets(r)) as unknown[], posts: posts.map((r) => stripSecrets(r)) as unknown[] },
  };
}
