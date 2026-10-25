import "server-only";
import { randomBytes } from "node:crypto";
import { createDeletionRequest, finishDeletionRequest, revokeFacebookUser, type DeletionSource } from "@/lib/data/social";
import { getMetaAppSecret } from "@/lib/social/keys";
import { parseSignedRequest } from "@/lib/social/signed-request";

export type DeletionResult = { ok: true; code: string } | { ok: false; reason: "not_configured" | "invalid_signature" | "failed" };

/**
 * Handles a call from Meta (data deletion request or app removal). No signed-in user is involved:
 * the only proof of origin is the signature made with the app secret. Anything unsigned is refused.
 */
export async function handleFacebookCallback(signedRequest: string, source: DeletionSource): Promise<DeletionResult> {
  const secret = getMetaAppSecret();
  if (!secret) return { ok: false, reason: "not_configured" };
  const parsed = parseSignedRequest(signedRequest, secret);
  if (!parsed) return { ok: false, reason: "invalid_signature" };

  const code = randomBytes(18).toString("base64url");
  try {
    await createDeletionRequest(code, source);
  } catch {
    return { ok: false, reason: "failed" };
  }
  try {
    const result = await revokeFacebookUser(parsed.userId);
    await finishDeletionRequest(code, "completed", result.accounts);
    return { ok: true, code };
  } catch {
    await finishDeletionRequest(code, "failed", 0).catch(() => undefined);
    return { ok: false, reason: "failed" };
  }
}
