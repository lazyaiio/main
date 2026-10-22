import "server-only";
import type { Db } from "./db";
import { unwrap } from "./db";

export type SourceDocRow = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  source_url: string;
  canonical_url: string | null;
  host: string;
  title: string | null;
  site_name: string | null;
  extracted_text: string | null;
  status: "ready" | "failed";
  error_code: string | null;
  content_hash: string | null;
  retrieved_at: string;
};

const COLUMNS =
  "id, workspace_id, project_id, source_url, canonical_url, host, title, site_name, extracted_text, status, error_code, content_hash, retrieved_at";

export async function getSourceDocument(db: Db, ws: string, id: string): Promise<SourceDocRow | null> {
  const res = await db.from("source_documents").select(COLUMNS).eq("workspace_id", ws).eq("id", id).maybeSingle();
  return unwrap(res, "load the source") as SourceDocRow | null;
}

/** A recently read copy of the same address, so we do not fetch the same page twice in a row. */
export async function findRecentReadySource(db: Db, ws: string, sourceUrl: string, sinceIso: string): Promise<SourceDocRow | null> {
  const res = await db
    .from("source_documents")
    .select(COLUMNS)
    .eq("workspace_id", ws)
    .eq("source_url", sourceUrl)
    .eq("status", "ready")
    .gte("retrieved_at", sinceIso)
    .order("retrieved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return unwrap(res, "load the source") as SourceDocRow | null;
}

export async function countSourceAttempts(
  db: Db,
  ws: string,
  filter: { userId?: string; host?: string },
  sinceIso: string,
): Promise<number> {
  let query = db
    .from("source_documents")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ws)
    .gte("created_at", sinceIso);
  if (filter.userId) query = query.eq("created_by", filter.userId);
  if (filter.host) query = query.eq("host", filter.host);
  const { count, error } = await query;
  if (error) throw new Error("Could not check usage.");
  return count ?? 0;
}

export async function recordSourceDocument(
  db: Db,
  args: {
    workspaceId: string;
    projectId: string | null;
    sourceUrl: string;
    canonicalUrl: string | null;
    host: string;
    title: string | null;
    siteName: string | null;
    text: string | null;
    status: "ready" | "failed";
    errorCode: string | null;
    hash: string | null;
    metadata: Record<string, string | number | boolean | null>;
  },
): Promise<string> {
  const { data, error } = await db.rpc("record_source_document", {
    p_workspace_id: args.workspaceId,
    p_project_id: args.projectId,
    p_source_url: args.sourceUrl,
    p_canonical_url: args.canonicalUrl,
    p_host: args.host,
    p_title: args.title,
    p_site_name: args.siteName,
    p_text: args.text,
    p_status: args.status,
    p_error_code: args.errorCode,
    p_hash: args.hash,
    p_metadata: args.metadata,
  });
  if (error || typeof data !== "string") throw new Error("Could not save the source.");
  return data;
}
