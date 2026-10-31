import { createHash, randomBytes } from "node:crypto";

/** Pure helpers for the "verify your email" link. Only a hash of the token is ever stored. */

export const TOKEN_LIFETIME_MS = 48 * 60 * 60 * 1000;
export const MIN_RESEND_GAP_MS = 60 * 1000;
export const MAX_SENDS_PER_WINDOW = 5;
export const SEND_WINDOW_MS = 60 * 60 * 1000;

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isTokenShape(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SendState = { lastSentAt: string | null; sendsInWindow: number; windowStartedAt: string | null };

/**
 * Whether another verification email may be sent now, and the new counters if it is.
 * At least a minute apart, and at most five per hour.
 */
export function planSend(state: SendState, now: Date): { allowed: true; next: { lastSentAt: string; sendsInWindow: number; windowStartedAt: string } } | { allowed: false; reason: "too_soon" | "too_many" } {
  const nowMs = now.getTime();
  if (state.lastSentAt && nowMs - new Date(state.lastSentAt).getTime() < MIN_RESEND_GAP_MS) return { allowed: false, reason: "too_soon" };
  const windowActive = state.windowStartedAt !== null && nowMs - new Date(state.windowStartedAt).getTime() < SEND_WINDOW_MS;
  const count = windowActive ? state.sendsInWindow : 0;
  if (count >= MAX_SENDS_PER_WINDOW) return { allowed: false, reason: "too_many" };
  return {
    allowed: true,
    next: { lastSentAt: now.toISOString(), sendsInWindow: count + 1, windowStartedAt: windowActive ? (state.windowStartedAt as string) : now.toISOString() },
  };
}

export function tokenExpired(expiresAt: string | null, now: Date): boolean {
  return !expiresAt || new Date(expiresAt).getTime() <= now.getTime();
}
