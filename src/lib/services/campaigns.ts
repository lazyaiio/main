import "server-only";
import { postRequestSchema, type PostRequest } from "@/lib/ai/post-schema";
import { canWrite } from "@/lib/auth/permissions";
import type { AppContext } from "@/lib/auth/session";
import { runBatch, DEFAULT_BATCH_OPTIONS, type BatchDeps, type BatchSlot } from "@/lib/campaign-batch";
import { classifyFailure } from "@/lib/campaign-failure";
import { briefToJson, buildPlan, slotsToJson, type CampaignFormInput, type PlannedSlot } from "@/lib/campaign-plan";
import { hashContent } from "@/lib/content";
import {
  PG_INVALID,
  PG_NOT_ALLOWED,
  PG_NOT_FOUND,
  PG_UNIQUE_VIOLATION,
  cancelCampaignRpc,
  claimSlotsRpc,
  completeSlotRpc,
  createCampaignWithSlots,
  getCampaign,
  listCampaignPostTexts,
  pauseCampaignRpc,
  releaseSlotRpc,
  retryFailedSlotsRpc,
  startCampaignRpc,
} from "@/lib/data/campaigns";
import { deleteContentItem, insertContentItem } from "@/lib/data/content";
import { DataError, getDb } from "@/lib/data/db";
import { getProject } from "@/lib/data/projects";
import { listSocialPages } from "@/lib/data/social";
import type { CampaignDetail, CampaignStatus, ProjectRow } from "@/lib/data/types";
import { finishCampaignPost } from "./campaign-finish";
import { logAudit } from "./audit";
import { notifyCampaignFinished, runLater } from "./email";
import { remainingMonthlyGenerations } from "./plans";
import { ServiceError } from "./errors";
import { generate, metadataFor, recordUsage, remainingHourlyAllowance, usableProviders, withSourceLink } from "./generation";
import { loadSourceMaterial, readSource, type SourceMaterial } from "./sources";

/** Time the whole generation request may use; the host allows 60 seconds. */
const TOTAL_BUDGET_MS = 55_000;
const SLOT_LEASE_SECONDS = 90;

function requireWrite(ctx: AppContext) {
  if (!ctx.emailVerified) throw new ServiceError("forbidden", "Please verify your email first. We sent you a link.");
  if (!canWrite(ctx.role)) throw new ServiceError("forbidden", "You do not have permission to do that.");
}

/** Turns an expected database refusal into a safe message. Anything else is passed on unchanged. */
function translate(error: unknown, fallback: string): never {
  if (error instanceof DataError) {
    if (error.code === PG_NOT_ALLOWED) throw new ServiceError("forbidden", "You do not have permission to do that.");
    if (error.code === PG_NOT_FOUND) throw new ServiceError("not_found", "That item could not be found.");
    if (error.code === "53400") throw new ServiceError("plan_limit", "You have reached the limit of your plan for open campaigns. Finish or cancel one first, or contact us to raise the limit.");
    if (error.code === PG_INVALID) throw new ServiceError("invalid", fallback);
    throw new ServiceError("failed", "Something went wrong. Please try again.");
  }
  throw error;
}

async function loadActiveProject(ctx: AppContext, projectId: string, languages: string[]): Promise<ProjectRow> {
  const db = await getDb();
  const project = await getProject(db, ctx.workspace.id, projectId);
  if (!project) throw new ServiceError("not_found", "That project could not be found.");
  if (project.status !== "active") throw new ServiceError("invalid", "That project is archived. Choose an active project.");
  if (!languages.every((language) => (project.languages as string[]).includes(language))) {
    throw new ServiceError("invalid", "That project is not set up for every language you chose.");
  }
  return project;
}

function planFor(ctx: AppContext, input: CampaignFormInput): PlannedSlot[] {
  const plan = buildPlan({
    startDate: input.startDate,
    durationDays: input.durationDays,
    itemCount: input.itemCount,
    languages: input.languages,
    formats: input.formats,
    postingDays: input.postingDays,
    times: input.times,
    themes: input.themes,
    timeZone: ctx.workspace.timezone,
    now: new Date(),
  });
  if (!plan.ok) throw new ServiceError("invalid", plan.error);
  return plan.slots;
}

/** Builds the proposed calendar without saving anything. */
export async function previewCampaign(ctx: AppContext, input: CampaignFormInput): Promise<PlannedSlot[]> {
  requireWrite(ctx);
  await loadActiveProject(ctx, input.projectId, input.languages);
  return planFor(ctx, input);
}

/** Saves the campaign and its planned posts. Nothing is written by AI yet. */
export async function createCampaign(ctx: AppContext, input: CampaignFormInput): Promise<string> {
  requireWrite(ctx);
  const project = await loadActiveProject(ctx, input.projectId, input.languages);
  const slots = planFor(ctx, input);

  let source: SourceMaterial | null = null;
  if (input.sourceUrl) source = await readSource(ctx, project.id, input.sourceUrl);

  const db = await getDb();
  if (input.autoSchedule) {
    const pages = await listSocialPages(db, ctx.workspace.id);
    const page = pages.find((p) => p.id === input.pageId);
    if (!page || page.status !== "connected" || page.capabilities.can_publish !== true) {
      throw new ServiceError("invalid", "Choose a connected Facebook Page where you are allowed to post.");
    }
  }
  let id: string;
  try {
    id = await createCampaignWithSlots(db, {
      workspaceId: ctx.workspace.id,
      projectId: project.id,
      name: input.name,
      durationDays: input.durationDays,
      languages: input.languages,
      brief: briefToJson({
        topic: input.topic ?? null,
        tone: input.tone ?? null,
        audience: input.audience ?? null,
        notes: input.notes ?? null,
        cta: input.cta ?? null,
        length: input.length,
        sourceDocumentId: source?.documentId ?? null,
        sourceUrl: source?.url ?? null,
        autoImage: input.autoImage,
        autoSchedule: input.autoSchedule,
        pageId: input.pageId || null,
      }),
      slots: slotsToJson(slots),
    });
  } catch (error) {
    translate(error, "That campaign could not be created. Check the dates and counts, and close finished campaigns if you have many open.");
  }
  await logAudit(db, ctx, "campaign.created", "campaign", id, { posts: slots.length, days: input.durationDays });
  return id;
}

export async function startCampaign(ctx: AppContext, campaignId: string): Promise<void> {
  requireWrite(ctx);
  const db = await getDb();
  if ((await usableProviders(db)).length === 0) {
    throw new ServiceError("not_configured", "AI generation is not set up yet. An admin needs to add an API key and turn on a provider.");
  }
  try {
    await startCampaignRpc(db, campaignId);
  } catch (error) {
    translate(error, "This campaign cannot be started right now.");
  }
  await logAudit(db, ctx, "campaign.started", "campaign", campaignId, {});
}

export async function pauseCampaign(ctx: AppContext, campaignId: string): Promise<void> {
  requireWrite(ctx);
  const db = await getDb();
  try {
    await pauseCampaignRpc(db, campaignId);
  } catch (error) {
    translate(error, "This campaign cannot be paused right now.");
  }
  await logAudit(db, ctx, "campaign.paused", "campaign", campaignId, {});
}

export async function cancelCampaign(ctx: AppContext, campaignId: string): Promise<void> {
  requireWrite(ctx);
  const db = await getDb();
  try {
    await cancelCampaignRpc(db, campaignId);
  } catch (error) {
    translate(error, "This campaign cannot be canceled right now.");
  }
  await logAudit(db, ctx, "campaign.canceled", "campaign", campaignId, {});
}

/** Puts failed posts back in the queue. Returns how many were reset. */
export async function retryFailedPosts(ctx: AppContext, campaignId: string): Promise<number> {
  requireWrite(ctx);
  const db = await getDb();
  if ((await usableProviders(db)).length === 0) {
    throw new ServiceError("not_configured", "AI generation is not set up yet. An admin needs to add an API key and turn on a provider.");
  }
  try {
    const count = await retryFailedSlotsRpc(db, campaignId);
    await logAudit(db, ctx, "campaign.retry_failed", "campaign", campaignId, { posts: count });
    return count;
  } catch (error) {
    translate(error, "There is nothing to retry right now.");
  }
}

// ---------------------------------------------------------------------------------------------
// Generation in small rounds
// ---------------------------------------------------------------------------------------------

/** What the browser needs after every round. */
export type CampaignRunState = {
  status: CampaignStatus;
  total: number;
  completed: number;
  failed: number;
  remaining: number;
  /** True while the browser should ask for another round. */
  keepGoing: boolean;
  /** A short note for the user (why it paused, or that some posts are being retried). */
  message: string | null;
};

export function runStateOf(campaign: CampaignDetail, message: string | null = null): CampaignRunState {
  const total = campaign.generation_progress.total ?? campaign.requested_item_count;
  const completed = campaign.generation_progress.completed ?? 0;
  const failed = campaign.generation_progress.failed ?? 0;
  return {
    status: campaign.status,
    total,
    completed,
    failed,
    remaining: Math.max(0, total - completed - failed),
    keepGoing: campaign.status === "generating",
    message,
  };
}

const NOT_CONFIGURED_MESSAGE = "Paused: AI generation is not set up. An admin needs to add an API key and turn on a provider. Nothing was lost.";
const RATE_LIMIT_MESSAGE = "Paused: the hourly generation limit was reached. Nothing was lost. Press Resume in a little while.";

/**
 * Writes the next few posts of a campaign (at most 3, within about 45 seconds) and returns the new
 * state. The browser calls this again until the campaign is no longer "generating". All progress
 * lives in the database, so closing the tab only pauses the work; reopening the page continues it.
 */
export async function runCampaignBatch(ctx: AppContext, campaignId: string): Promise<CampaignRunState> {
  const startedAt = Date.now();
  requireWrite(ctx);
  const db = await getDb();
  const ws = ctx.workspace.id;

  const campaign = await getCampaign(db, ws, campaignId);
  if (!campaign) throw new ServiceError("not_found", "That campaign could not be found.");
  if (campaign.status !== "generating") return runStateOf(campaign);

  /** Pauses the campaign (so the browser stops asking) and reports why. */
  const stopWith = async (message: string): Promise<CampaignRunState> => {
    try {
      await pauseCampaignRpc(db, campaignId);
    } catch {
      // Already paused or finished by someone else; the reload below shows the truth.
    }
    const latest = (await getCampaign(db, ws, campaignId)) ?? campaign;
    return runStateOf(latest, message);
  };

  const providers = await usableProviders(db);
  if (providers.length === 0) return stopWith(NOT_CONFIGURED_MESSAGE);

  const project = await getProject(db, ws, campaign.project_id);
  if (!project) return stopWith("Paused: the project for this campaign could not be found.");

  let source: SourceMaterial | null = null;
  if (campaign.brief.source_document_id) {
    source = await loadSourceMaterial(ctx, campaign.brief.source_document_id);
    if (!source) {
      return stopWith("Paused: the article this campaign is based on is no longer available. Cancel this campaign and create a new one.");
    }
  }

  if ((await remainingMonthlyGenerations(db, ctx).catch(() => Number.POSITIVE_INFINITY)) <= 0) {
    return stopWith("Paused: your plan\u2019s AI posts for this month are used up. The count resets at the start of next month, or contact us to raise the limit.");
  }
  const allowance = await remainingHourlyAllowance(db, ctx);
  const existing = await listCampaignPostTexts(db, ws, campaignId);
  const total = campaign.requested_item_count;
  const brief = campaign.brief;

  type Generated = Awaited<ReturnType<typeof generate>>;
  type Draft = { hook: string | null; body: string; generated: Generated; request: PostRequest };

  const imageBriefs = new Map<string, string | null>();

  const deps: BatchDeps<Draft> = {
    now: () => Date.now(),
    allowance,
    existing,
    claim: async (limit) => {
      const rows = await claimSlotsRpc(db, campaignId, limit, SLOT_LEASE_SECONDS);
      return rows.map(
        (row): BatchSlot => ({
          id: row.id,
          index: row.slot_index,
          language: row.language,
          format: row.content_format,
          theme: row.theme,
          plannedAt: row.planned_at,
          attempts: row.attempts,
        }),
      );
    },
    generate: async (slot, context) => {
      const parsed = postRequestSchema.safeParse({
        projectId: project.id,
        language: slot.language,
        format: slot.format,
        topic: brief.topic || source?.title || (source ? "the source article" : undefined),
        length: brief.length ?? "medium",
        tone: brief.tone,
        audience: brief.audience,
        notes: brief.notes,
        cta: brief.cta,
      });
      if (!parsed.success) throw new ServiceError("invalid", "The settings for this post are no longer valid.");

      // Give each slot the time that is left in this request, never more than the host allows.
      const budgetStart = Date.now() + context.remainingMs - TOTAL_BUDGET_MS;
      const generated = await generate(db, parsed.data, source, budgetStart, {
        position: slot.index + 1,
        total,
        theme: slot.theme,
        avoidHooks: context.avoidHooks,
        attempt: slot.attempts,
      });
      await recordUsage(db, ctx, "ai.campaign_post", generated, slot.id, "campaign_slot");
      return {
        hook: generated.output.hook || null,
        body: generated.output.body,
        generated,
        request: parsed.data,
      };
    },
    save: async (slot, draft) => {
      const { generated, request } = draft;
      try {
        const id = await insertContentItem(db, ws, {
          projectId: project.id,
          campaignId,
          language: slot.language,
          contentFormat: slot.format,
          hook: generated.output.hook || null,
          body: withSourceLink(generated.output.body, source),
          cta: generated.output.cta || null,
          hashtags: generated.output.hashtags,
          imageBrief: generated.output.image_brief || null,
          sourceUrl: source?.url ?? null,
          contentHash: hashContent(generated.output.body),
          aiProvider: generated.provider,
          aiModel: generated.model,
          promptVersion: generated.promptVersion,
          usageMetadata: {
            ...metadataFor(generated, request, source),
            campaign: { id: campaignId, slot_id: slot.id, slot_index: slot.index },
          },
        });
        if (!id) throw new ServiceError("failed", "We could not save the generated post.");
        imageBriefs.set(slot.id, generated.output.image_brief || null);
        return { kind: "saved", itemId: id };
      } catch (error) {
        // The same wording already exists in this campaign (unique index): try again with a new angle.
        if (error instanceof DataError && error.code === PG_UNIQUE_VIOLATION) return { kind: "duplicate" };
        throw error;
      }
    },
    complete: async (slot, itemId) => {
      const accepted = await completeSlotRpc(db, slot.id, itemId);
      if (accepted) {
        await finishCampaignPost({
          workspaceId: ws,
          userId: campaign.created_by,
          brief,
          itemId,
          plannedAt: slot.plannedAt ?? null,
          imageBrief: imageBriefs.get(slot.id) ?? null,
        });
        imageBriefs.delete(slot.id);
      }
      return accepted;
    },
    discard: async (itemId) => {
      await deleteContentItem(db, ws, itemId);
    },
    release: (slot, code, options) => releaseSlotRpc(db, slot.id, code, options),
    classify: classifyFailure,
  };

  const summary = await runBatch(deps, { ...DEFAULT_BATCH_OPTIONS, budgetMs: Math.min(DEFAULT_BATCH_OPTIONS.budgetMs, TOTAL_BUDGET_MS - (Date.now() - startedAt) - 5_000) });

  if (summary.stop === "not_configured") return stopWith(NOT_CONFIGURED_MESSAGE);
  if (summary.stop === "rate_limited") return stopWith(RATE_LIMIT_MESSAGE);
  if (summary.stop === "plan_limit") return stopWith("Paused: you have reached the post limit of your plan. Delete posts you no longer need, or contact us to raise the limit.");

  const latest = (await getCampaign(db, ws, campaignId)) ?? campaign;
  if (campaign.status === "generating" && latest.status !== "generating") {
    await logAudit(db, ctx, "campaign.generation_finished", "campaign", campaignId, {
      status: latest.status,
      completed: latest.generation_progress.completed ?? 0,
      failed: latest.generation_progress.failed ?? 0,
    });
    // Tell the person who planned it (never blocks or breaks generation).
    if ((latest.status === "ready" || latest.status === "failed") && latest.created_by) {
      const finished = { userId: latest.created_by, workspaceId: ws, campaignId, name: latest.name, completed: latest.generation_progress.completed ?? 0, failed: latest.generation_progress.failed ?? 0, total: latest.requested_item_count };
      runLater(() => notifyCampaignFinished(finished));
    }
  }
  const message =
    summary.duplicates > 0 || summary.failures > 0
      ? "Some posts needed another try. They are retried automatically, up to 3 times each."
      : null;
  return runStateOf(latest, message);
}
