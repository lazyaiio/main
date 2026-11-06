"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { parseNoticeForm } from "@/lib/notices";
import { saveNotice } from "@/lib/services/notices";

const text = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
};

/** Saves the announcement banner and the maintenance switch. */
export async function saveNoticeAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const parsed = parseNoticeForm({
    announcementEnabled: formData.get("announcementEnabled") === "on",
    text: text(formData, "text"),
    tone: text(formData, "tone"),
    linkLabel: text(formData, "linkLabel"),
    linkUrl: text(formData, "linkUrl"),
    maintenanceEnabled: formData.get("maintenanceEnabled") === "on",
    message: text(formData, "message"),
  });
  if (!parsed.ok) redirect(`/admin/notices?error=${encodeURIComponent(parsed.error)}`);
  try {
    await saveNotice(parsed.value, ctx.user.id);
  } catch {
    redirect("/admin/notices?error=" + encodeURIComponent("Could not save. Check that the service key is set and try again."));
  }
  revalidatePath("/", "layout");
  redirect("/admin/notices?notice=saved");
}
