"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { setLaunchItem } from "@/lib/data/launch";
import { isManualId } from "@/lib/launch-checklist";

export async function toggleLaunchItemAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const id = formData.get("id");
  const done = formData.get("done") === "1";
  if (typeof id !== "string" || !isManualId(id)) redirect("/admin/launch?error=invalid");
  try {
    await setLaunchItem(id, done, ctx.user.id);
  } catch {
    redirect("/admin/launch?error=failed");
  }
  revalidatePath("/admin/launch");
  redirect(`/admin/launch#${id}`);
}
