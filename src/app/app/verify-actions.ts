"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { sendVerificationEmail } from "@/lib/services/email-verification";

/** "Send the link again" button in the verification banner. */
export async function resendVerificationAction(): Promise<void> {
  const ctx = await requireAppContext();
  const result = await sendVerificationEmail(ctx.user.id);
  revalidatePath("/app", "layout");
  const code = result === "sent" ? "verify_sent" : result === "auto_verified" || result === "already_verified" ? "verified" : result === "failed" ? "verify_error" : "verify_wait";
  redirect(`/app?notice=${code}`);
}
