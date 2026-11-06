"use server";

import { headers } from "next/headers";
import type { FormState } from "@/lib/auth/form-state";
import { looksLikeSpam, parseContactForm } from "@/lib/support";
import { submitContact } from "@/lib/services/support";

const text = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
};

const THANKS = "Thank you. Your message was sent. We will reply by email.";

/** The public Contact form. Spam is answered with the same thank-you so a bot learns nothing. */
export async function sendContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { name: text(formData, "name"), email: text(formData, "email"), topic: text(formData, "topic") || "support", subject: text(formData, "subject"), message: text(formData, "message") };
  const parsed = parseContactForm(values);
  if (!parsed.ok) return { error: parsed.error, values };

  if (looksLikeSpam({ website: formData.get("website"), startedAt: formData.get("startedAt"), message: parsed.value.message })) {
    return { success: true, message: THANKS };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  const result = await submitContact(parsed.value, { ip, userAgent: h.get("user-agent") ?? "" });
  if (result === "rate_limited") return { error: "You have sent several messages already. Please wait a while and try again.", values };
  if (result === "failed") return { error: "Your message could not be sent right now. Please try again in a few minutes.", values };
  return { success: true, message: THANKS };
}
