import "server-only";
import type { AppContext } from "@/lib/auth/session";
import { DataError, getDb, type Db } from "@/lib/data/db";
import { PG_LIMIT_REACHED, getWorkspaceLimits, getWorkspaceUsage, rateLimitHit } from "@/lib/data/plans";
import { MONTHLY_AI_MESSAGE, PLAN_LIMIT_MESSAGE, buildUsageRows, type UsageRow } from "@/lib/plans";
import { ServiceError } from "./errors";

/** Turns the database's "limit reached" refusal into a clear message. Everything else passes through. */
export async function withPlanLimit<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof DataError && error.code === PG_LIMIT_REACHED) throw new ServiceError("plan_limit", PLAN_LIMIT_MESSAGE);
    throw error;
  }
}

export type PlanOverview = { plan: string; rows: UsageRow[] };

export async function getPlanOverview(ctx: AppContext): Promise<PlanOverview> {
  const db = await getDb();
  const [{ plan, limits }, usage] = await Promise.all([getWorkspaceLimits(db, ctx.workspace.id), getWorkspaceUsage(db, ctx.workspace.id)]);
  return { plan, rows: buildUsageRows(limits, usage) };
}

/** How many AI posts the plan still allows this month (Infinity when there is no limit). */
export async function remainingMonthlyGenerations(db: Db, ctx: AppContext): Promise<number> {
  const [{ limits }, usage] = await Promise.all([getWorkspaceLimits(db, ctx.workspace.id), getWorkspaceUsage(db, ctx.workspace.id)]);
  const limit = limits.ai_generations_month;
  return limit === null ? Number.POSITIVE_INFINITY : Math.max(0, limit - usage.ai_generations_month);
}

export async function enforceMonthlyGenerations(db: Db, ctx: AppContext): Promise<void> {
  if ((await remainingMonthlyGenerations(db, ctx)) <= 0) throw new ServiceError("plan_limit", MONTHLY_AI_MESSAGE);
}

/** Counts one attempt of an expensive action by this person; refuses when they do it too often. */
export async function enforceRate(db: Db, action: string, limit: number, windowSeconds: number): Promise<void> {
  if (!(await rateLimitHit(db, action, limit, windowSeconds))) {
    throw new ServiceError("too_many_requests", "You are doing that too often. Please wait a few minutes and try again.");
  }
}
