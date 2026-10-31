import "server-only";
import { findByTokenHash, getVerificationRow, markVerified, saveToken } from "@/lib/data/email-verification";
import { getEmailConfig } from "@/lib/email/keys";
import { TOKEN_LIFETIME_MS, generateToken, hashToken, isTokenShape, planSend, tokenExpired } from "@/lib/email-verification";
import { getAppBaseUrl } from "@/lib/email/keys";
import { logError } from "@/lib/log";
import { sendNotification } from "./email";
import { getUserName } from "@/lib/data/email";

export type VerificationSend = "sent" | "already_verified" | "auto_verified" | "too_soon" | "too_many" | "failed";

/** Email can only be verified when the site can send email. Without it, accounts are trusted instead of locked out. */
function canSendEmail(): boolean {
  const config = getEmailConfig();
  return Boolean(config.apiKey && config.from);
}

/**
 * Sends the "verify your email" message. Never throws. When the site cannot send email at all, the account is
 * marked verified (otherwise nobody could ever use it).
 */
export async function sendVerificationEmail(userId: string): Promise<VerificationSend> {
  try {
    const row = await getVerificationRow(userId);
    if (row?.verifiedAt) return "already_verified";
    if (!canSendEmail()) {
      await markVerified(userId);
      return "auto_verified";
    }
    const now = new Date();
    const plan = planSend(row ?? { lastSentAt: null, sendsInWindow: 0, windowStartedAt: null }, now);
    if (!plan.allowed) return plan.reason;

    const token = generateToken();
    await saveToken(userId, { tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS).toISOString(), ...plan.next });
    const name = await getUserName(userId).catch(() => null);
    const verifyUrl = `${getAppBaseUrl().replace(/\/+$/, "")}/auth/verify-email?token=${token}`;
    const result = await sendNotification({
      data: { template: "verify_email", name, verifyUrl },
      userId,
      workspaceId: null,
      dedupeKey: `verify:${userId}:${hashToken(token).slice(0, 16)}`,
      preference: null,
    });
    return result.status === "sent" ? "sent" : "failed";
  } catch (error) {
    logError("email_verification.send_failed", { name: error instanceof Error ? error.name : "unknown" });
    return "failed";
  }
}

/** Opens a verification link. Returns true when the account is now verified. */
export async function verifyEmailToken(token: unknown): Promise<boolean> {
  if (!isTokenShape(token)) return false;
  try {
    const found = await findByTokenHash(hashToken(token));
    if (!found || tokenExpired(found.expiresAt, new Date())) return false;
    await markVerified(found.userId);
    return true;
  } catch {
    return false;
  }
}

/** The email link of someone who confirmed through Supabase's own link (or reset their password) proves the mailbox too. */
export async function markVerifiedByEmailLink(userId: string): Promise<void> {
  try {
    await markVerified(userId);
  } catch {
    // The person can still use the verification email.
  }
}
