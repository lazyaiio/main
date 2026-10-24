import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Helpers for the OAuth "state" check. A connection attempt is accepted only when ALL of these agree:
 *  1. the state value Facebook sends back,
 *  2. the secret cookie set in this browser when the attempt started,
 *  3. the hash stored on the server for this attempt (one-time, expires after 10 minutes),
 * and the signed-in user and workspace are the same ones that started it.
 */

export const FLOW_COOKIE = "lazyai_meta_flow";
export const FLOW_TTL_MS = 10 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NONCE_RE = /^[A-Za-z0-9_-]{40,64}$/;

export function newNonce(): string {
  return randomBytes(32).toString("base64url");
}

export function hashNonce(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex");
}

export function buildFlowCookie(flowId: string, nonce: string): string {
  return `${flowId}.${nonce}`;
}

export function parseFlowCookie(value: string | undefined | null): { flowId: string; nonce: string } | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot < 0) return null;
  const flowId = value.slice(0, dot);
  const nonce = value.slice(dot + 1);
  if (!UUID_RE.test(flowId) || !NONCE_RE.test(nonce)) return null;
  return { flowId, nonce };
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** True only when the returned state, the cookie nonce, and the stored hash all match. */
export function verifyCallbackState(input: { urlState: string | null | undefined; cookieNonce: string; storedHash: string }): boolean {
  if (!input.urlState || !NONCE_RE.test(input.urlState)) return false;
  if (!safeEqual(input.urlState, input.cookieNonce)) return false;
  return safeEqual(hashNonce(input.cookieNonce), input.storedHash);
}

export function isFlowExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}
