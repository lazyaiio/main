import "server-only";
import { createHash } from "node:crypto";
import { utcDay, visitorHash } from "@/lib/analytics";
import { canSubmitMessage, getMessage, insertMessage, markReplied } from "@/lib/data/support";
import { EmailError, createResendSender } from "@/lib/email/provider";
import { getAppBaseUrl, getEmailConfig } from "@/lib/email/keys";
import { renderEmail } from "@/lib/email/templates";
import { describeError, logError } from "@/lib/log";
import { getTokenEncryptionKey } from "@/lib/social/keys";
import { replySubject, type ContactInput } from "@/lib/support";

export type SubmitResult = "ok" | "rate_limited" | "failed";

/**
 * Saves a message from the public Contact form. The sender's address is never stored: only a one-way label
 * that changes every day (needs TOKEN_ENCRYPTION_KEY; without it only the per-email limit applies).
 */
export async function submitContact(input: ContactInput, meta: { ip: string; userAgent: string }): Promise<SubmitResult> {
  try {
    const secret = getTokenEncryptionKey();
    const ipHash = secret && meta.ip ? visitorHash(secret, utcDay(new Date()), meta.ip, meta.userAgent) : "";
    if (!(await canSubmitMessage(ipHash, input.email))) return "rate_limited";
    await insertMessage(input, ipHash);
    return "ok";
  } catch (error) {
    logError("support.submit_failed", describeError(error));
    return "failed";
  }
}

export type ReplyResult = { status: "sent" } | { status: "failed"; reason: "not_found" | "not_configured" | "rejected" | "rate_limited" | "temporary" | "invalid" | "unexpected" };

/**
 * Sends one reply to the person who wrote. Only called when an admin presses the button. A repeated press with the
 * same words is a no-op at the email service for 24 hours, so a double click cannot send two copies.
 */
export async function sendSupportReply(id: string, body: string, adminId: string): Promise<ReplyResult> {
  try {
    const message = await getMessage(id);
    if (!message) return { status: "failed", reason: "not_found" };
    const config = getEmailConfig();
    if (!config.apiKey || !config.from) return { status: "failed", reason: "not_configured" };

    const mail = renderEmail({ template: "support_reply", name: message.name, reply: body, original: message.message }, getAppBaseUrl());
    const key = `support-${id}-${createHash("sha256").update(body).digest("hex").slice(0, 24)}`;
    try {
      await createResendSender(config.apiKey)({
        from: config.from,
        to: message.email,
        ...mail,
        subject: replySubject({ subject: message.subject, topic: message.topic }),
        idempotencyKey: key,
      });
    } catch (error) {
      return { status: "failed", reason: error instanceof EmailError ? error.kind : "temporary" };
    }
    await markReplied(id, adminId).catch((error) => logError("support.mark_replied_failed", describeError(error)));
    return { status: "sent" };
  } catch (error) {
    logError("support.reply_failed", describeError(error));
    return { status: "failed", reason: "unexpected" };
  }
}
