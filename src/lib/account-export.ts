import { redactObject } from "./redact";

/**
 * What goes into "Download my data". An allow-list per table: only the listed columns can ever be
 * exported, and anything whose name looks secret is dropped even if it was listed by mistake. Storage
 * paths, tokens, ciphertext, and other people's identities are never included.
 */

export const MAX_EXPORT_ROWS = 5000;

export type ExportTable = { key: string; table: string; columns: readonly string[]; note?: string };

export const EXPORT_TABLES: readonly ExportTable[] = [
  { key: "profile", table: "profiles", columns: ["display_name", "preferred_language", "timezone", "onboarded_at", "created_at"] },
  { key: "workspaces", table: "workspaces", columns: ["id", "name", "timezone", "plan", "created_at"] },
  { key: "memberships", table: "workspace_members", columns: ["workspace_id", "role", "created_at"] },
  { key: "projects", table: "content_projects", columns: ["id", "name", "input_type", "input_value", "languages", "tone", "audience", "notes", "status", "created_at", "updated_at"] },
  { key: "campaigns", table: "campaigns", columns: ["id", "project_id", "name", "status", "duration_days", "requested_item_count", "languages", "approval_mode", "generation_progress", "brief", "created_at"] },
  { key: "campaign_plan", table: "campaign_slots", columns: ["id", "campaign_id", "slot_index", "planned_at", "language", "content_format", "theme", "status", "content_item_id", "created_at"] },
  { key: "posts", table: "content_items", columns: ["id", "project_id", "campaign_id", "language", "content_format", "hook", "body", "cta", "hashtags", "image_brief", "source_url", "approval_status", "ai_provider", "ai_model", "created_at", "updated_at"] },
  { key: "post_images", table: "content_item_media", columns: ["content_item_id", "media_asset_id", "sort_order"] },
  { key: "images", table: "media_assets", columns: ["id", "alt_text", "attribution", "source_url", "mime_type", "byte_size", "width", "height", "created_at"], note: "Image files are not included, only their details." },
  { key: "source_pages", table: "source_documents", columns: ["id", "url", "title", "created_at"] },
  { key: "schedule", table: "scheduled_posts", columns: ["id", "content_item_id", "social_page_id", "scheduled_at", "status", "published_at", "last_error", "created_at"] },
  { key: "facebook_accounts", table: "social_accounts", columns: ["id", "display_name", "status", "created_at"], note: "Access tokens are never exported." },
  { key: "facebook_pages", table: "social_pages", columns: ["id", "name", "category", "status", "created_at"] },
  { key: "activity", table: "audit_events", columns: ["action", "entity_type", "entity_id", "metadata", "created_at"] },
  { key: "usage", table: "usage_records", columns: ["action_type", "provider", "units", "created_at"] },
  { key: "email_choices", table: "email_preferences", columns: ["campaign_complete", "publish_failures", "page_alerts"] },
];

const FORBIDDEN_NAME = /(token|secret|password|ciphertext|cookie|storage_path|thumb_path|state_hash|payload|signature)/i;

export type ExportPart = { rows: Record<string, unknown>[]; truncated: boolean };

function shapeRow(row: Record<string, unknown>, columns: readonly string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const column of columns) {
    if (FORBIDDEN_NAME.test(column)) continue;
    if (column in row) picked[column] = row[column];
  }
  return redactObject(picked);
}

export function shapeExport(parts: Record<string, ExportPart>, meta: { generatedAt: string }) {
  const data: Record<string, unknown> = {};
  const truncated: string[] = [];
  const notes: Record<string, string> = {};
  for (const table of EXPORT_TABLES) {
    const part = parts[table.key] ?? { rows: [], truncated: false };
    const rows = part.rows.slice(0, MAX_EXPORT_ROWS).map((row) => shapeRow(row, table.columns));
    data[table.key] = table.key === "profile" ? (rows[0] ?? null) : rows;
    if (part.truncated || part.rows.length > MAX_EXPORT_ROWS) truncated.push(table.key);
    if (table.note) notes[table.key] = table.note;
  }
  return {
    format: "lazyai-export",
    version: 1,
    generated_at: meta.generatedAt,
    description: "Your LazyAI data: workspace content, schedules, and activity. Passwords, access tokens, and image files are not included.",
    notes,
    truncated,
    data,
  };
}

export function exportFileName(now: Date = new Date()): string {
  return `lazyai-export-${now.toISOString().slice(0, 10)}.json`;
}
