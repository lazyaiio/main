import "server-only";
import { getMaxGenerationsPerHour } from "@/lib/ai/keys";
import { postRequestSchema, type PostRequest } from "@/lib/ai/post-schema";
import { DEFAULT_BATCH_OPTIONS, runBatch, type BatchDeps, type BatchSlot } from "@/lib/campaign-batch";
import { classifyFailure } from "@/lib/campaign-failure";
import { hashContent } from "@/lib/content";
import { countRecentAiUsage } from "@/lib/data/ai-settings";
import { PG_UNIQUE_VIOLATION, claimSlotsRpc, completeSlotRpc, getCampaign, listCampaignPostTexts, pauseCampaignRpc, releaseSlotRpc } from "@/lib/data/campaigns";
import { deleteContentItem, insertContentItem } from "@/lib/data/content";
import { DataError, type Db } from "@/lib/data/db";
import { adminDb } from "@/lib/data/platform";
import { getProject } from "@/lib/data/projects";
import type { CampaignDetail } from "@/lib/data/types";
import { monthStartUtc, parseNumberMap } from "@/lib/plans";
import { logError } from "@/lib/log";
import { finishCampaignPost } from "./campaign-finish";
import { generate, metadataFor, usableProviders, withSourceLink } from "./generation";
import { ServiceError } from "./errors";
import { loadSourceMaterialForWorkspace, type SourceMaterial } from "./sources";
import { notifyCampaignFinished, runLater } from "./email";

const SLOT_LEASE_SECONDS = 90;

export type BackgroundSummary = { campaigns: number; saved: number; failures: number };

/** How many AI posts the workspace's plan still allows this month (Infinity when there is no limit). */
async function remainingMonthly(db: Db, workspaceId: string): Promise<number> {
  const ws = await db.from("workspaces").select("plan, limit_overrides").eq("id", workspaceId).maybeSingle();
  const row = ws.data as { plan: string; limit_overrides: unknown } | null;
  if (!row) return 0;
  let limit: number | null | undefined = parseNumberMap(row.limit_overrides).ai_generations_month;
  if (limit === undefined) {
    const plan = await db.from("plans").select("limits").eq("key", row.plan).maybeSingle();
    limit = parseNumberMap((plan.data as { limits: unknown } | null)?.limits).ai_generations_month;
  }
  if (limit === null || limit === undefined) return Number.POSITIVE_INFINITY;
  const { count } = await db
    .from("usage_records")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .like("action_type", "ai.%")
    .gte("created_at", monthStartUtc());
  return Math.max(0, limit - (count ?? 0));
}

/** Writes the next few posts of one campaign. Mirrors runCampaignBatch, but with no signed-in person. */
async function runOneCampaign(db: Db, campaign: CampaignDetail, budgetMs: number): Promise<{ saved: number; failures: number }> {
  const ws = campaign.workspace_id;
  const campaignId = campaign.id;
  const userId = campaign.created_by;
  const pause = async () => {
    try {
      await pauseCampaignRpc(db, campaignId);
    } catch {
      // Already paused or finished.
    }
  };

  if ((await usableProviders(db)).length === 0) return { saved: 0, failures: 0 };
  const project = await getProject(db, ws, campaign.project_id);
  if (!project) {
    await pause();
    return { saved: 0, failures: 0 };
  }
  let source: SourceMaterial | null = null;
  if (campaign.brief.source_document_id) {
    source = await loadSourceMaterialForWorkspace(db, ws, campaign.brief.source_document_id);
    if (!source) {
      await pause();
      return { saved: 0, failures: 0 };
    }
  }

  const monthly = await remainingMonthly(db, ws).catch(() => 0);
  const hourlyUsed = userId ? await countRecentAiUsage(db, ws, userId, new Date(Date.now() - 3_600_000).toISOString()) : 0;
  const allowance = Math.min(monthly, Math.max(0, getMaxGenerationsPerHour() - hourlyUsed));
  if (allowance <= 0) return { saved: 0, failures: 0 }; // try again in a later minute; nothing is lost

  const existing = await listCampaignPostTexts(db, ws, campaignId);
  const brief = campaign.brief;
  const total = campaign.requested_item_count;
  const imageBriefs = new Map<string, string | null>();
  type Draft = { hook: string | null; body: string; generated: Awaited<ReturnType<typeof generate>>; request: PostRequest };
  const startedAt = Date.now();

  const deps: BatchDeps<Draft> = {
    now: () => Date.now(),
    allowance,
    existing,
    claim: async (limit) =>
      (await claimSlotsRpc(db, campaignId, limit, SLOT_LEASE_SECONDS)).map(
        (row): BatchSlot => ({ id: row.id, index: row.slot_index, language: row.language, format: row.content_format, theme: row.theme, plannedAt: row.planned_at, attempts: row.attempts }),
      ),
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
      const generated = await generate(db, parsed.data, source, Date.now() + context.remainingMs - 55_000, {
        position: slot.index + 1,
        total,
        theme: slot.theme,
        avoidHooks: context.avoidHooks,
        attempt: slot.attempts,
      });
      try {
        await db.from("usage_records").insert({
          workspace_id: ws,
          user_id: userId,
          action_type: "ai.campaign_post",
          provider: generated.provider.slice(0, 40),
          model: generated.model.slice(0, 120),
          units: Math.min(1_000_000, generated.inputTokens + generated.outputTokens),
          related_entity_type: "campaign_slot",
          related_entity_id: slot.id,
        });
      } catch {
        // Bookkeeping must not lose the post.
      }
      return { hook: generated.output.hook || null, body: generated.output.body, generated, request: parsed.data };
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
          usageMetadata: { ...metadataFor(generated, request, source), campaign: { id: campaignId, slot_id: slot.id, slot_index: slot.index } },
        });
        if (!id) throw new ServiceError("failed", "We could not save the generated post.");
        imageBriefs.set(slot.id, generated.output.image_brief || null);
        return { kind: "saved", itemId: id };
      } catch (error) {
        if (error instanceof DataError && error.code === PG_UNIQUE_VIOLATION) return { kind: "duplicate" };
        throw error;
      }
    },
    complete: async (slot, itemId) => {
      const accepted = await completeSlotRpc(db, slot.id, itemId);
      if (accepted) {
        await finishCampaignPost({ workspaceId: ws, userId, brief, itemId, plannedAt: slot.plannedAt ?? null, imageBrief: imageBriefs.get(slot.id) ?? null });
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

  const summary = await runBatch(deps, { ...DEFAULT_BATCH_OPTIONS, budgetMs: Math.max(0, Math.min(DEFAULT_BATCH_OPTIONS.budgetMs, budgetMs - (Date.now() - startedAt))) });
  if (summary.stop === "not_configured" || summary.stop === "plan_limit") await pause();

  const latest = await getCampaign(db, ws, campaignId);
  if (latest && latest.status !== "generating" && (latest.status === "ready" || latest.status === "failed") && latest.created_by) {
    const finished = { userId: latest.created_by, workspaceId: ws, campaignId, name: latest.name, completed: latest.generation_progress.completed ?? 0, failed: latest.generation_progress.failed ?? 0, total };
    runLater(() => notifyCampaignFinished(finished));
  }
  return { saved: summary.saved, failures: summary.failures };
}

/**
 * Keeps campaigns that are "generating" moving even when nobody has the page open. Called by the protected
 * scheduler endpoint every minute, after publishing. Stops starting new work when the time budget is used.
 */
export async function runBackgroundCampaigns(budgetMs: number): Promise<BackgroundSummary> {
  const summary: BackgroundSummary = { campaigns: 0, saved: 0, failures: 0 };
  const startedAt = Date.now();
  const db = adminDb();
  const { data, error } = await db.from("campaigns").select("*").eq("status", "generating").order("created_at", { ascending: true }).limit(5);
  if (error || !data) return summary;

  for (const campaign of data as CampaignDetail[]) {
    const left = budgetMs - (Date.now() - startedAt);
    if (left < DEFAULT_BATCH_OPTIONS.minSlotMs + 5_000) break;
    try {
      const result = await runOneCampaign(db, campaign, left - 5_000);
      summary.campaigns++;
      summary.saved += result.saved;
      summary.failures += result.failures;
    } catch (e) {
      summary.failures++;
      logError("campaign.background_failed", { name: e instanceof Error ? e.name : "unknown" });
    }
  }
  return summary;
}
