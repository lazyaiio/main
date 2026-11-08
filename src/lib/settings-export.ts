/** Pure rules for the site settings export (no database, no network). */

/** Only these platform settings are copied. Payment credentials, stock photo keys and anything else stay out. */
export const EXPORTABLE_SETTING_KEYS = ["seo", "site_notice", "analytics", "billing", "lifetime_deal"] as const;

const SECRET_NAME = /secret|token|password|api[_-]?key|private/i;

/** Copies a value but drops every property whose name looks like a secret, at any depth. */
export function stripSecrets(value: unknown, depth = 0): unknown {
  if (depth > 8) return null;
  if (Array.isArray(value)) return value.map((v) => stripSecrets(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([name]) => !SECRET_NAME.test(name))
        .map(([name, v]) => [name, stripSecrets(v, depth + 1)]),
    );
  }
  return value;
}

export type SettingRow = { key: string; value: unknown; updated_at?: string };

/** Keeps the allowed keys only and strips secret-looking properties from what is kept. */
export function pickExportableSettings(rows: SettingRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    if ((EXPORTABLE_SETTING_KEYS as readonly string[]).includes(row.key)) out[row.key] = stripSecrets(row.value);
  }
  return out;
}

export function exportFilename(now: Date = new Date()): string {
  return `lazyai-settings-${now.toISOString().slice(0, 10)}.json`;
}

export type SettingsExport = {
  app: "LazyAI";
  kind: "site-settings";
  version: 1;
  exportedAt: string;
  includes: string[];
  excludes: string[];
  platformSettings: Record<string, unknown>;
  plans: unknown[];
  sitePages: unknown[];
  seoPages: unknown[];
  blog: { categories: unknown[]; posts: unknown[] };
};

export const EXPORT_INCLUDES = [
  "Plans, prices and limits",
  "Site currency, SEO, announcement banner, lifetime deal text and analytics settings",
  "Editable pages (Terms, Privacy, Help, About, home page and the others)",
  "Page-by-page SEO overrides",
  "Blog categories and every article, drafts included (text only, not the photo files)",
];
export const EXPORT_EXCLUDES = [
  "bKash credentials, AI provider keys, stock photo keys and email keys",
  "People, workspaces, posts, campaigns, media files, payments and support messages",
  "Page history (older versions)",
];
