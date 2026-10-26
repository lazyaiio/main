import "server-only";
import { canWrite } from "@/lib/auth/permissions";
import type { AppContext } from "@/lib/auth/session";
import { localToUtc } from "@/lib/campaign-plan";
import { DataError, getDb } from "@/lib/data/db";
import {
  cancelScheduledPostRpc,
  listSchedulesForItem,
  markPostPublishedRpc,
  reschedulePostRpc,
  retryFailedPostRpc,
  schedulePostRpc,
  type ScheduleRow,
} from "@/lib/data/scheduling";
import { listSocialPages } from "@/lib/data/social";
import { isLiveFlagOn } from "@/lib/data/platform";
import { getSocialMode, isPublishingBlockedByEnv } from "@/lib/social/keys";
import { logAudit } from "./audit";
import { ServiceError } from "./errors";

function requireWrite(ctx: AppContext) {
  if (!canWrite(ctx.role)) throw new ServiceError("forbidden", "You do not have permission to do that.");
}

/** Turns a database refusal into a clear message. */
function mapError(error: unknown): never {
  if (!(error instanceof DataError)) throw error;
  const text = error.message.toLowerCase();
  if (error.code === "42501") throw new ServiceError("forbidden", "You do not have permission to do that.");
  if (error.code === "P0002") throw new ServiceError("not_found", "That post or Page could not be found.");
  if (error.code === "23505") throw new ServiceError("schedule_exists", "This post is already scheduled or published on that Page.");
  if (error.code === "22023") {
    if (text.includes("not approved")) throw new ServiceError("schedule_not_approved", "Only approved posts can be scheduled.");
    if (text.includes("invalid time")) throw new ServiceError("schedule_time", "Choose a time at least a few minutes from now and within the next year.");
    if (text.includes("page") || text.includes("cannot publish")) throw new ServiceError("schedule_page", "Choose a connected Facebook Page where you are allowed to post.");
    if (text.startsWith("cannot")) throw new ServiceError("schedule_state", "That change is not possible for this post in its current state.");
  }
  throw new ServiceError("failed", "Something went wrong. Please try again.");
}

/** "2026-11-02T10:00" typed in the workspace timezone -> a UTC moment. */
export function parseLocalDateTime(value: string, timeZone: string): Date {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value.trim());
  if (!match?.[1] || !match[2]) throw new ServiceError("schedule_time", "Choose a valid date and time.");
  try {
    const at = localToUtc(match[1], match[2], timeZone);
    if (Number.isNaN(at.getTime())) throw new Error("bad date");
    return at;
  } catch {
    throw new ServiceError("schedule_time", "Choose a valid date and time.");
  }
}

export type ItemSchedule = ScheduleRow & { pageName: string };

export type ItemScheduling = {
  schedules: ItemSchedule[];
  pages: { id: string; name: string }[];
  /** False while live publishing is switched off (scheduled posts wait until it is turned on). */
  publishingEnabled: boolean;
  mock: boolean;
};

export async function getItemScheduling(ctx: AppContext, itemId: string): Promise<ItemScheduling> {
  const db = await getDb();
  const [schedules, pages] = await Promise.all([listSchedulesForItem(db, ctx.workspace.id, itemId), listSocialPages(db, ctx.workspace.id)]);
  const names = new Map(pages.map((p) => [p.id, p.name]));
  return {
    schedules: schedules.map((s) => ({ ...s, pageName: names.get(s.social_page_id) ?? "Facebook Page" })),
    pages: pages.filter((p) => p.status === "connected" && p.capabilities.can_publish === true).map((p) => ({ id: p.id, name: p.name })),
    publishingEnabled: getSocialMode() === "mock" || (!isPublishingBlockedByEnv() && (await isLiveFlagOn(db))),
    mock: getSocialMode() === "mock",
  };
}

export async function schedulePost(ctx: AppContext, input: { itemId: string; pageId: string; localDateTime: string }): Promise<void> {
  requireWrite(ctx);
  const at = parseLocalDateTime(input.localDateTime, ctx.workspace.timezone);
  const db = await getDb();
  let id: string;
  try {
    id = await schedulePostRpc(db, { workspaceId: ctx.workspace.id, itemId: input.itemId, pageId: input.pageId, at });
  } catch (error) {
    mapError(error);
  }
  await logAudit(db, ctx, "post.scheduled", "scheduled_post", id, { at: at.toISOString() });
}

export async function rescheduleScheduledPost(ctx: AppContext, scheduleId: string, localDateTime: string): Promise<void> {
  requireWrite(ctx);
  const at = parseLocalDateTime(localDateTime, ctx.workspace.timezone);
  const db = await getDb();
  try {
    await reschedulePostRpc(db, scheduleId, at);
  } catch (error) {
    mapError(error);
  }
  await logAudit(db, ctx, "post.rescheduled", "scheduled_post", scheduleId, { at: at.toISOString() });
}

export async function cancelSchedule(ctx: AppContext, scheduleId: string): Promise<void> {
  requireWrite(ctx);
  const db = await getDb();
  try {
    await cancelScheduledPostRpc(db, scheduleId);
  } catch (error) {
    mapError(error);
  }
  await logAudit(db, ctx, "post.schedule_canceled", "scheduled_post", scheduleId, {});
}

export async function retrySchedule(ctx: AppContext, scheduleId: string): Promise<void> {
  requireWrite(ctx);
  const db = await getDb();
  try {
    await retryFailedPostRpc(db, scheduleId);
  } catch (error) {
    mapError(error);
  }
  await logAudit(db, ctx, "post.schedule_retried", "scheduled_post", scheduleId, {});
}

/** "It is on my Page": a person checked after an uncertain result. */
export async function markScheduleSeenOnPage(ctx: AppContext, scheduleId: string): Promise<void> {
  requireWrite(ctx);
  const db = await getDb();
  try {
    await markPostPublishedRpc(db, scheduleId);
  } catch (error) {
    mapError(error);
  }
  await logAudit(db, ctx, "post.marked_published", "scheduled_post", scheduleId, {});
}
