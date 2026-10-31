import "server-only";
import { canWrite } from "@/lib/auth/permissions";
import type { AppContext } from "@/lib/auth/session";
import {
  canTransition,
  hashContent,
  isDeletable,
  parseHashtags,
  type ContentFormInput,
} from "@/lib/content";
import { deleteContentItem, getContentItem, insertContentItem, updateContentItem } from "@/lib/data/content";
import { getDb } from "@/lib/data/db";
import { getProject } from "@/lib/data/projects";
import type { ApprovalStatus, Language } from "@/lib/data/types";
import { logAudit } from "./audit";
import { ServiceError } from "./errors";
import { withPlanLimit } from "./plans";

function requireWrite(ctx: AppContext) {
  if (!ctx.emailVerified) throw new ServiceError("forbidden", "Please verify your email first. We sent you a link.");
  if (!canWrite(ctx.role)) throw new ServiceError("forbidden", "You do not have permission to do that.");
}

const NOT_FOUND = () => new ServiceError("not_found", "That post could not be found.");

export async function createManualPost(
  ctx: AppContext,
  input: { projectId: string | null; language: Language; body: string },
): Promise<string> {
  requireWrite(ctx);
  const db = await getDb();

  if (input.projectId) {
    const project = await getProject(db, ctx.workspace.id, input.projectId);
    if (!project) throw new ServiceError("not_found", "That project could not be found.");
  }

  const id = await withPlanLimit(() => insertContentItem(db, ctx.workspace.id, {
    projectId: input.projectId,
    language: input.language,
    contentFormat: "text",
    hook: null,
    body: input.body,
    cta: null,
    hashtags: [],
    imageBrief: null,
    contentHash: hashContent(input.body),
    aiProvider: null,
    aiModel: null,
    promptVersion: null,
    usageMetadata: {},
  }));
  if (!id) throw new ServiceError("failed", "We could not create the post.");
  await logAudit(db, ctx, "content.created", "content_item", id, { language: input.language });
  return id;
}

/** Saves the edits. There is no review step, so saving never changes the post's status. */
export async function updateContent(ctx: AppContext, id: string, input: ContentFormInput): Promise<void> {
  requireWrite(ctx);
  const db = await getDb();

  const item = await getContentItem(db, ctx.workspace.id, id);
  if (!item) throw NOT_FOUND();

  const hashtags = parseHashtags(input.hashtags ?? "");
  const hook = input.hook || null;
  const cta = input.cta || null;
  const imageBrief = input.imageBrief || null;

  const ok = await updateContentItem(db, ctx.workspace.id, id, {
    hook,
    body: input.body,
    cta,
    hashtags,
    image_brief: imageBrief,
    content_hash: hashContent(input.body),
  });
  if (!ok) throw NOT_FOUND();

  await logAudit(db, ctx, "content.updated", "content_item", id, {});
}

export async function setContentStatus(ctx: AppContext, id: string, to: ApprovalStatus): Promise<void> {
  requireWrite(ctx);
  const db = await getDb();

  const item = await getContentItem(db, ctx.workspace.id, id);
  if (!item) throw NOT_FOUND();
  if (!canTransition(item.approval_status, to)) {
    throw new ServiceError("invalid", "That change is not allowed for this post right now.");
  }

  const ok = await updateContentItem(db, ctx.workspace.id, id, { approval_status: to });
  if (!ok) throw NOT_FOUND();
  await logAudit(db, ctx, "content.status_changed", "content_item", id, { to });
}

export async function deleteContent(ctx: AppContext, id: string): Promise<void> {
  requireWrite(ctx);
  const db = await getDb();

  const item = await getContentItem(db, ctx.workspace.id, id);
  if (!item) throw NOT_FOUND();
  if (!isDeletable(item.approval_status)) {
    throw new ServiceError("invalid", "Move this post back to draft before deleting it.");
  }

  try {
    const ok = await deleteContentItem(db, ctx.workspace.id, id);
    if (!ok) throw NOT_FOUND();
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("in_use", "This post is used by a schedule, so it cannot be deleted.");
  }
  await logAudit(db, ctx, "content.deleted", "content_item", id, {});
}
