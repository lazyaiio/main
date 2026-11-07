/** Pure helpers for the payment and plan emails (no database, no network). */

export const ENDING_SOON_DAYS = 7;

/** "May 3, 2027" in UTC, so every reader sees the same day the plan ends. */
export function formatEndDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/** Whole days from `now` until `iso`, rounded up, never below 0. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const ms = new Date(iso).getTime() - now.getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 86_400_000)) : 0;
}

/** One email per workspace per end date. A renewal moves the end date, so the next ending gets its own email. */
export const endingSoonKey = (workspaceId: string, expiresAt: string): string => `plan_ending:${workspaceId}:${expiresAt.slice(0, 10)}`;
export const endedKey = (workspaceId: string, expiresAt: string): string => `plan_ended:${workspaceId}:${expiresAt.slice(0, 10)}`;
export const receiptKey = (paymentId: string): string => `receipt:${paymentId}`;
