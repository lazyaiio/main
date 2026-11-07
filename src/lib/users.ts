/** Pure rules for admin user management (no database, no network). */

export const USERS_PER_PAGE = 25;
export const SUSPEND_REASON_MAX = 300;
export const PLAN_PERIOD_CHOICES = ["manual", "monthly", "yearly", "lifetime"] as const;
export type PlanPeriodChoice = (typeof PLAN_PERIOD_CHOICES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isUuid = (value: string): boolean => UUID.test(value);

/** A search box value made safe to send: trimmed, one line, at most 80 characters, no control characters. */
export function cleanSearch(value: string | string[] | undefined): string {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function parsePage(value: string | string[] | undefined): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(n) && n >= 1 && n <= 10_000 ? n : 1;
}

export function cleanReason(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, SUSPEND_REASON_MAX);
}

export type PlanChange =
  | { ok: true; plan: string; period: "monthly" | "yearly" | "lifetime" | null; expiresAt: string | null }
  | { ok: false; message: string };

/**
 * Turns the "change plan" form into what is stored.
 *  - Free: no period and no end date.
 *  - A paid plan with "manual": no period and no end date (stays until an admin changes it).
 *  - Lifetime: never ends.
 *  - Monthly or yearly: needs an end date (a day in the future, at most five years away); the plan ends at the end of that day (UTC).
 */
export function buildPlanChange(input: { plan: string; knownPlans: string[]; period: string; endsOn: string }, now: Date = new Date()): PlanChange {
  const plan = input.plan.trim();
  if (!input.knownPlans.includes(plan)) return { ok: false, message: "Choose one of the existing plans." };
  if (plan === "free") return { ok: true, plan, period: null, expiresAt: null };
  if (!(PLAN_PERIOD_CHOICES as readonly string[]).includes(input.period)) return { ok: false, message: "Choose how the plan is held." };
  if (input.period === "manual") return { ok: true, plan, period: null, expiresAt: null };
  if (input.period === "lifetime") return { ok: true, plan, period: "lifetime", expiresAt: null };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.endsOn)) return { ok: false, message: "Choose the day the plan ends." };
  const end = new Date(`${input.endsOn}T23:59:59Z`);
  if (Number.isNaN(end.getTime()) || end.toISOString().slice(0, 10) !== input.endsOn) return { ok: false, message: "That date does not exist." };
  if (end.getTime() <= now.getTime()) return { ok: false, message: "The end date must be in the future." };
  if (end.getTime() > now.getTime() + 5 * 366 * 86_400_000) return { ok: false, message: "The end date is too far away (five years at most)." };
  return { ok: true, plan, period: input.period as "monthly" | "yearly", expiresAt: end.toISOString() };
}

/** How a person's plan reads in the list. */
export function describePlan(row: { plan: string | null; plan_period: string | null; plan_expires_at: string | null }): string {
  const plan = row.plan ?? "free";
  if (plan === "free") return "Free";
  if (row.plan_period === "lifetime") return `${plan} (lifetime)`;
  if (row.plan_expires_at) return `${plan} until ${row.plan_expires_at.slice(0, 10)}`;
  return `${plan} (no end date)`;
}
