"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { setNote, setStatus } from "@/lib/data/support";
import { sendSupportReply } from "@/lib/services/support";
import { noteSchema, replySchema, statusSchema } from "@/lib/support";

const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
};

/** Where to go back to: the same filter and the same message. Only known filter words are accepted. */
function backTo(formData: FormData, extra: string): string {
  const filter = field(formData, "filter");
  const id = field(formData, "id");
  const parts: string[] = [];
  if (["new", "open", "closed", "all"].includes(filter)) parts.push(`status=${filter}`);
  if (/^[0-9a-f-]{36}$/i.test(id)) parts.push(`id=${id}`);
  parts.push(extra);
  return `/admin/support?${parts.join("&")}`;
}

export async function changeStatusAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const parsed = statusSchema.safeParse({ id: field(formData, "id"), status: field(formData, "newStatus") });
  if (!parsed.success) redirect(backTo(formData, "error=invalid"));
  try {
    await setStatus(parsed.data.id, parsed.data.status, ctx.user.id);
  } catch {
    redirect(backTo(formData, "error=failed"));
  }
  revalidatePath("/admin/support");
  redirect(backTo(formData, "notice=status"));
}

export async function saveNoteAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const parsed = noteSchema.safeParse({ id: field(formData, "id"), note: field(formData, "note") });
  if (!parsed.success) redirect(backTo(formData, "error=invalid"));
  try {
    await setNote(parsed.data.id, parsed.data.note, ctx.user.id);
  } catch {
    redirect(backTo(formData, "error=failed"));
  }
  revalidatePath("/admin/support");
  redirect(backTo(formData, "notice=note"));
}

/** Sends one real email to the person who wrote. Runs only when an admin presses "Send reply". */
export async function sendReplyAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const parsed = replySchema.safeParse({ id: field(formData, "id"), body: field(formData, "body") });
  if (!parsed.success) redirect(backTo(formData, "error=reply_invalid"));
  const result = await sendSupportReply(parsed.data.id, parsed.data.body, ctx.user.id);
  revalidatePath("/admin/support");
  if (result.status === "sent") redirect(backTo(formData, "notice=replied"));
  redirect(backTo(formData, result.reason === "not_configured" ? "error=email_not_configured" : "error=reply_failed"));
}
