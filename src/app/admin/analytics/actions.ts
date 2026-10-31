"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { writeAnalyticsSettings } from "@/lib/data/analytics";
import { forgetAnalyticsSettings } from "@/lib/services/analytics";

export async function saveAnalyticsSettingsAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const days = Number(formData.get("retentionDays"));
  if (!Number.isInteger(days) || days < 30 || days > 3650) redirect("/admin/analytics?error=retention");
  try {
    await writeAnalyticsSettings({ enabled: formData.get("enabled") === "on", retentionDays: days }, ctx.user.id);
  } catch {
    redirect("/admin/analytics?error=save");
  }
  forgetAnalyticsSettings();
  revalidatePath("/admin/analytics");
  redirect("/admin/analytics?notice=saved");
}
