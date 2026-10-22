import "server-only";
import type { Db } from "./db";
import { unwrap } from "./db";
import type { ApprovalStatus, ContentItemFull, Language } from "./types";

export type NewContentItem = {
  projectId: string | null;
  language: Language;
  contentFormat: string;
  hook: string | null;
  body: string;
  cta: string | null;
  hashtags: string[];
  imageBrief: string | null;
  sourceUrl?: string | null;
  contentHash: string;
  aiProvider: string | null;
  aiModel: string | null;
  promptVersion: string | null;
  usageMetadata: Record<string, unknown>;
};

export async function getContentItem(db: Db, ws: string, id: string): Promise<ContentItemFull | null> {
  const res = await db.from("content_items").select("*").eq("workspace_id", ws).eq("id", id).maybeSingle();
  return unwrap(res, "load the post") as ContentItemFull | null;
}

export async function insertContentItem(db: Db, ws: string, item: NewContentItem): Promise<string | null> {
  const res = await db
    .from("content_items")
    .insert({
      workspace_id: ws,
      project_id: item.projectId,
      language: item.language,
      content_format: item.contentFormat,
      hook: item.hook,
      body: item.body,
      cta: item.cta,
      hashtags: item.hashtags,
      image_brief: item.imageBrief,
      source_url: item.sourceUrl ?? null,
      content_hash: item.contentHash,
      approval_status: "draft",
      ai_provider: item.aiProvider,
      ai_model: item.aiModel,
      prompt_version: item.promptVersion,
      usage_metadata: item.usageMetadata,
    })
    .select("id")
    .single();
  const row = unwrap(res, "create the post") as { id: string } | null;
  return row?.id ?? null;
}

export type ContentPatch = Partial<{
  hook: string | null;
  body: string;
  cta: string | null;
  hashtags: string[];
  image_brief: string | null;
  content_hash: string;
  approval_status: ApprovalStatus;
  ai_provider: string | null;
  ai_model: string | null;
  prompt_version: string | null;
  usage_metadata: Record<string, unknown>;
}>;

/** True when exactly one row changed (RLS hides rows the user may not touch). */
export async function updateContentItem(db: Db, ws: string, id: string, patch: ContentPatch): Promise<boolean> {
  const res = await db.from("content_items").update(patch).eq("workspace_id", ws).eq("id", id).select("id");
  return ((unwrap(res, "update the post") as unknown[] | null) ?? []).length === 1;
}

export async function deleteContentItem(db: Db, ws: string, id: string): Promise<boolean> {
  const res = await db.from("content_items").delete().eq("workspace_id", ws).eq("id", id).select("id");
  return ((unwrap(res, "delete the post") as unknown[] | null) ?? []).length === 1;
}

export async function countSimilarByHash(db: Db, ws: string, hash: string, excludeId: string): Promise<number> {
  const { count, error } = await db
    .from("content_items")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ws)
    .eq("content_hash", hash)
    .neq("id", excludeId);
  if (error) throw new Error("Could not check for similar posts.");
  return count ?? 0;
}
