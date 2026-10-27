import "server-only";
import type { Db } from "./db";
import { EXPORT_TABLES, MAX_EXPORT_ROWS, type ExportPart } from "@/lib/account-export";

/**
 * Collects the signed-in person's data with THEIR OWN session, so row security decides what they can see:
 * only workspaces they belong to. Columns are narrowed again by the allow-list in account-export.ts.
 */
export async function collectExport(db: Db, userId: string): Promise<Record<string, ExportPart>> {
  const parts: Record<string, ExportPart> = {};
  for (const table of EXPORT_TABLES) {
    let query = db.from(table.table).select("*").limit(MAX_EXPORT_ROWS + 1);
    if (table.table === "profiles") query = query.eq("id", userId);
    if (table.table === "workspace_members" || table.table === "email_preferences") query = query.eq("user_id", userId);
    if (table.table === "usage_records") query = query.eq("user_id", userId);
    const { data, error } = await query;
    const rows = error || !Array.isArray(data) ? [] : (data as Record<string, unknown>[]);
    parts[table.key] = { rows: rows.slice(0, MAX_EXPORT_ROWS), truncated: rows.length > MAX_EXPORT_ROWS };
  }
  return parts;
}
