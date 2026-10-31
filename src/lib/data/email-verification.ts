import "server-only";
import { adminDb } from "./platform";
import { DataError } from "./db";
import type { SendState } from "@/lib/email-verification";

export type VerificationRow = SendState & { verifiedAt: string | null };

type Raw = { verified_at: string | null; last_sent_at: string | null; sends_in_window: number; window_started_at: string | null };

export async function getVerificationRow(userId: string): Promise<VerificationRow | null> {
  const { data, error } = await adminDb().from("user_email_verification").select("verified_at, last_sent_at, sends_in_window, window_started_at").eq("user_id", userId).maybeSingle();
  if (error) throw new DataError("Could not read the verification state.", error.code);
  const row = data as Raw | null;
  return row ? { verifiedAt: row.verified_at, lastSentAt: row.last_sent_at, sendsInWindow: row.sends_in_window, windowStartedAt: row.window_started_at } : null;
}

/** Saves a new token (its hash) and the send counters. Creates the row when the person has none yet. */
export async function saveToken(userId: string, input: { tokenHash: string; expiresAt: string; lastSentAt: string; sendsInWindow: number; windowStartedAt: string }): Promise<void> {
  const { error } = await adminDb()
    .from("user_email_verification")
    .upsert(
      { user_id: userId, token_hash: input.tokenHash, token_expires_at: input.expiresAt, last_sent_at: input.lastSentAt, sends_in_window: input.sendsInWindow, window_started_at: input.windowStartedAt },
      { onConflict: "user_id" },
    );
  if (error) throw new DataError("Could not save the verification link.", error.code);
}

export async function markVerified(userId: string): Promise<void> {
  const { error } = await adminDb()
    .from("user_email_verification")
    .upsert({ user_id: userId, verified_at: new Date().toISOString(), token_hash: null, token_expires_at: null }, { onConflict: "user_id" });
  if (error) throw new DataError("Could not mark the email verified.", error.code);
}

export async function findByTokenHash(tokenHash: string): Promise<{ userId: string; expiresAt: string | null; verifiedAt: string | null } | null> {
  const { data, error } = await adminDb().from("user_email_verification").select("user_id, token_expires_at, verified_at").eq("token_hash", tokenHash).maybeSingle();
  if (error) throw new DataError("Could not look up the verification link.", error.code);
  const row = data as { user_id: string; token_expires_at: string | null; verified_at: string | null } | null;
  return row ? { userId: row.user_id, expiresAt: row.token_expires_at, verifiedAt: row.verified_at } : null;
}
