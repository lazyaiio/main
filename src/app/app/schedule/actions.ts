"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppContext } from "@/lib/auth/session";
import { ServiceError } from "@/lib/services/errors";
import * as scheduling from "@/lib/services/scheduling";

const uuid = z.string().uuid();
const when = z.string().trim().max(20);

function errorCode(error: unknown): string {
  return error instanceof ServiceError ? error.kind : "failed";
}

async function run(formData: FormData, notice: string, work: (ctx: Awaited<ReturnType<typeof requireAppContext>>, itemId: string) => Promise<void>): Promise<void> {
  const itemId = uuid.safeParse(formData.get("itemId"));
  if (!itemId.success) redirect("/app/content");
  const ctx = await requireAppContext();
  try {
    await work(ctx, itemId.data);
  } catch (error) {
    redirect(`/app/content/${itemId.data}?error=${errorCode(error)}`);
  }
  revalidatePath(`/app/content/${itemId.data}`);
  revalidatePath("/app/calendar");
  redirect(`/app/content/${itemId.data}?notice=${notice}`);
}

export async function scheduleAction(formData: FormData): Promise<void> {
  const pageId = uuid.safeParse(formData.get("pageId"));
  const at = when.safeParse(formData.get("when"));
  return run(formData, "scheduled", async (ctx, itemId) => {
    if (!pageId.success) throw new ServiceError("schedule_page", "Choose a Page.");
    if (!at.success) throw new ServiceError("schedule_time", "Choose a valid date and time.");
    await scheduling.schedulePost(ctx, { itemId, pageId: pageId.data, localDateTime: at.data });
  });
}

export async function rescheduleAction(formData: FormData): Promise<void> {
  const scheduleId = uuid.safeParse(formData.get("scheduleId"));
  const at = when.safeParse(formData.get("when"));
  return run(formData, "schedule_changed", async (ctx) => {
    if (!scheduleId.success) throw new ServiceError("not_found", "Not found.");
    if (!at.success) throw new ServiceError("schedule_time", "Choose a valid date and time.");
    await scheduling.rescheduleScheduledPost(ctx, scheduleId.data, at.data);
  });
}

export async function cancelScheduleAction(formData: FormData): Promise<void> {
  const scheduleId = uuid.safeParse(formData.get("scheduleId"));
  return run(formData, "schedule_canceled", async (ctx) => {
    if (!scheduleId.success) throw new ServiceError("not_found", "Not found.");
    await scheduling.cancelSchedule(ctx, scheduleId.data);
  });
}

export async function retryScheduleAction(formData: FormData): Promise<void> {
  const scheduleId = uuid.safeParse(formData.get("scheduleId"));
  return run(formData, "schedule_retried", async (ctx) => {
    if (!scheduleId.success) throw new ServiceError("not_found", "Not found.");
    await scheduling.retrySchedule(ctx, scheduleId.data);
  });
}

export async function markSeenOnPageAction(formData: FormData): Promise<void> {
  const scheduleId = uuid.safeParse(formData.get("scheduleId"));
  return run(formData, "marked_published", async (ctx) => {
    if (!scheduleId.success) throw new ServiceError("not_found", "Not found.");
    await scheduling.markScheduleSeenOnPage(ctx, scheduleId.data);
  });
}
