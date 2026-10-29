import "server-only";
import { AiError, describeAiError } from "@/lib/ai/errors";
import { generatePostContent, type GeneratedPost } from "@/lib/ai/generate-post";
import { createProviderInstance, getMaxGenerationsPerHour, hasApiKey, isMockEnabled } from "@/lib/ai/keys";
import { createMockProvider } from "@/lib/ai/mock";
import type { CampaignPromptContext, PromptSource } from "@/lib/ai/prompts";
import { postRequestSchema, type PostRequest } from "@/lib/ai/post-schema";
import { generateWithFallback, type EnabledProvider } from "@/lib/ai/router";
import { canWrite } from "@/lib/auth/permissions";
import type { AppContext } from "@/lib/auth/session";
import { hashContent } from "@/lib/content";
import { countRecentAiUsage, listEnabledProviders, recordAiUsage } from "@/lib/data/ai-settings";
import { getContentItem, insertContentItem, updateContentItem } from "@/lib/data/content";
import { getDb, type Db } from "@/lib/data/db";
import { getProject } from "@/lib/data/projects";
import { enforceMonthlyGenerations, remainingMonthlyGenerations, withPlanLimit } from "./plans";
import { logAudit } from "./audit";
import { ServiceError } from "./errors";
import { loadSourceMaterial, readSource, type SourceMaterial } from "./sources";

/** The longest a whole generation (reading a page plus writing) may take; hosting allows 60 seconds. */
const TOTAL_BUDGET_MS = 55_000;

const NOT_CONFIGURED = new ServiceError("not_configured", describeAiError("not_configured"));

function requireWrite(ctx: AppContext) {
  if (!canWrite(ctx.role)) throw new ServiceError("forbidden", "You do not have permission to do that.");
}

/** Providers an admin turned on AND that have a key. Falls back to the mock outside production. */
export async function usableProviders(db: Db): Promise<EnabledProvider[]> {
  const enabled = await listEnabledProviders(db);
  const usable = enabled.filter((p) => p.provider !== "mock" && hasApiKey(p.provider));
  if (usable.length > 0) return usable;
  if (isMockEnabled()) return [{ provider: "mock", model: "mock-1", priority: 1 }];
  return [];
}

/** For the UI: can generation work right now? */
export async function getAiAvailability(): Promise<{ available: boolean; usingMock: boolean }> {
  const providers = await usableProviders(await getDb());
  return { available: providers.length > 0, usingMock: providers.some((p) => p.provider === "mock") };
}

/** How many AI generations this user may still run in the current hour. */
export async function remainingHourlyAllowance(db: Db, ctx: AppContext): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const used = await countRecentAiUsage(db, ctx.workspace.id, ctx.user.id, since);
  const hourly = Math.max(0, getMaxGenerationsPerHour() - used);
  // The plan's monthly allowance also counts.
  return Math.min(hourly, await remainingMonthlyGenerations(db, ctx).catch(() => Number.POSITIVE_INFINITY));
}

async function enforceRateLimit(db: Db, ctx: AppContext) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const used = await countRecentAiUsage(db, ctx.workspace.id, ctx.user.id, since);
  if (used >= getMaxGenerationsPerHour()) {
    throw new ServiceError("rate_limited", "You have reached the hourly generation limit. Please try again later.");
  }
  await enforceMonthlyGenerations(db, ctx);
}

export async function generate(
  db: Db,
  request: PostRequest,
  source: PromptSource | null,
  startedAt: number,
  campaign: CampaignPromptContext | null = null,
): Promise<GeneratedPost> {
  const providers = await usableProviders(db);
  if (providers.length === 0) throw NOT_CONFIGURED;

  try {
    return await generatePostContent(
      request,
      (req) =>
        generateWithFallback(req, {
          providers,
          getProvider: (id) => (id === "mock" ? createMockProvider() : createProviderInstance(id)),
          deadlineMs: Math.max(0, startedAt + TOTAL_BUDGET_MS - Date.now()),
        }),
      source,
      campaign,
    );
  } catch (error) {
    if (error instanceof AiError) {
      throw new ServiceError(error.kind === "not_configured" ? "not_configured" : "ai_failed", describeAiError(error.kind));
    }
    throw error;
  }
}

export async function recordUsage(
  db: Db,
  ctx: AppContext,
  actionType: "ai.generate_post" | "ai.regenerate_post" | "ai.campaign_post",
  generated: GeneratedPost,
  entityId?: string,
  entityType = "content_item",
) {
  try {
    await recordAiUsage(db, {
      workspaceId: ctx.workspace.id,
      actionType,
      provider: generated.provider,
      model: generated.model,
      units: generated.inputTokens + generated.outputTokens,
      entityType,
      entityId,
    });
  } catch {
    // The post already exists; a bookkeeping hiccup must not lose it.
  }
}

function requestSummary(request: PostRequest, source: SourceMaterial | null): Record<string, string> {
  const summary: Record<string, string> = { length: request.length };
  if (request.topic) summary.topic = request.topic;
  if (source) summary.source_document_id = source.documentId;
  if (request.tone) summary.tone = request.tone;
  if (request.audience) summary.audience = request.audience;
  if (request.notes) summary.notes = request.notes;
  if (request.cta) summary.cta = request.cta;
  return summary;
}

export function metadataFor(generated: GeneratedPost, request: PostRequest, source: SourceMaterial | null) {
  return {
    input_tokens: generated.inputTokens,
    output_tokens: generated.outputTokens,
    fact_check_flags: generated.output.fact_check_flags,
    repaired: generated.repaired,
    request: requestSummary(request, source),
    ...(source ? { source: { document_id: source.documentId, url: source.url, title: source.title } } : {}),
  };
}

/** Posts based on an article end with a link back to it. */
export function withSourceLink(body: string, source: SourceMaterial | null): string {
  return source ? `${body}\n\nSource: ${source.url}` : body;
}

export async function generatePost(ctx: AppContext, request: PostRequest): Promise<string> {
  const startedAt = Date.now();
  requireWrite(ctx);
  const db = await getDb();

  const project = await getProject(db, ctx.workspace.id, request.projectId);
  if (!project) throw new ServiceError("not_found", "That project could not be found.");
  if (!project.languages.includes(request.language)) {
    throw new ServiceError("invalid", "That project is not set up for the chosen language.");
  }

  await enforceRateLimit(db, ctx);
  const source = request.sourceUrl ? await readSource(ctx, project.id, request.sourceUrl) : null;
  const generated = await generate(db, request, source, startedAt);
  const { output } = generated;
  const body = withSourceLink(output.body, source);

  let id: string | null = null;
  try {
    id = await withPlanLimit(() => insertContentItem(db, ctx.workspace.id, {
      projectId: project.id,
      language: request.language,
      contentFormat: request.format,
      hook: output.hook || null,
      body,
      cta: output.cta || null,
      hashtags: output.hashtags,
      imageBrief: output.image_brief || null,
      sourceUrl: source?.url ?? null,
      contentHash: hashContent(output.body),
      aiProvider: generated.provider,
      aiModel: generated.model,
      promptVersion: generated.promptVersion,
      usageMetadata: metadataFor(generated, request, source),
    }));
  } finally {
    await recordUsage(db, ctx, "ai.generate_post", generated, id ?? undefined);
  }
  if (!id) throw new ServiceError("failed", "We could not save the generated post.");

  await logAudit(db, ctx, "content.generated", "content_item", id, { format: request.format, language: request.language });
  return id;
}

export async function regeneratePost(ctx: AppContext, itemId: string): Promise<void> {
  const startedAt = Date.now();
  requireWrite(ctx);
  const db = await getDb();

  const item = await getContentItem(db, ctx.workspace.id, itemId);
  if (!item) throw new ServiceError("not_found", "That post could not be found.");

  const stored = item.usage_metadata?.request;
  if (!item.project_id || !stored) {
    throw new ServiceError("invalid", "This post was not generated by AI, so there is nothing to regenerate.");
  }
  let source: SourceMaterial | null = null;
  if (stored.source_document_id) {
    source = await loadSourceMaterial(ctx, stored.source_document_id);
    if (!source) throw new ServiceError("invalid", "The article this post was based on is no longer available.");
  }

  const parsed = postRequestSchema.safeParse({
    projectId: item.project_id,
    language: item.language,
    format: item.content_format,
    topic: stored.topic ?? source?.title ?? (source ? "the source article" : undefined),
    length: stored.length,
    tone: stored.tone,
    audience: stored.audience,
    notes: stored.notes,
    cta: stored.cta,
  });
  if (!parsed.success) throw new ServiceError("invalid", "The original settings for this post can no longer be used.");

  await enforceRateLimit(db, ctx);
  const generated = await generate(db, parsed.data, source, startedAt);
  const { output } = generated;
  const body = withSourceLink(output.body, source);

  let ok = false;
  try {
    ok = await updateContentItem(db, ctx.workspace.id, itemId, {
      hook: output.hook || null,
      body,
      cta: output.cta || null,
      hashtags: output.hashtags,
      image_brief: output.image_brief || null,
      content_hash: hashContent(output.body),
      approval_status: "approved",
      ai_provider: generated.provider,
      ai_model: generated.model,
      prompt_version: generated.promptVersion,
      usage_metadata: metadataFor(generated, parsed.data, source),
    });
  } finally {
    await recordUsage(db, ctx, "ai.regenerate_post", generated, itemId);
  }
  if (!ok) throw new ServiceError("failed", "We could not save the new version.");

  await logAudit(db, ctx, "content.regenerated", "content_item", itemId, {});
}
