"use server";

import { requirePlatformAdmin } from "@/lib/auth/admin";
import type { FormState } from "@/lib/auth/form-state";
import { EMAIL_ERROR_TEXT, type EmailErrorKind } from "@/lib/email/provider";
import { sendTestEmail } from "@/lib/services/email";

/** Sends a real test email to the admin's own address and says plainly what happened. */
export async function sendTestEmailAction(): Promise<FormState> {
  const ctx = await requirePlatformAdmin();
  const result = await sendTestEmail(ctx.user.id);
  if (result.status === "sent") return { success: true, message: "Test email sent. Check your inbox (and spam folder) in a minute." };
  const reason = result.reason ?? "unexpected";
  if (reason === "not_configured") return { error: EMAIL_ERROR_TEXT.not_configured };
  if (reason === "suppressed") return { error: "Your own address is paused because of an earlier bounce or spam complaint." };
  if (reason in EMAIL_ERROR_TEXT) return { error: EMAIL_ERROR_TEXT[reason as EmailErrorKind] };
  return { error: "The test email could not be sent. Check the settings and try again." };
}
