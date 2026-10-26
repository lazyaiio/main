"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import type { FormState } from "@/lib/auth/form-state";
import { getDb } from "@/lib/data/db";
import { setLivePublishing } from "@/lib/data/platform";
import { dispatchDuePosts } from "@/lib/services/publisher";

/** Switches real Facebook posting on or off for the whole site. Turning it on needs the confirmation box. */
export async function setLivePublishingAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const turnOn = formData.get("enable") === "on";
  if (turnOn && formData.get("confirm") !== "on") redirect("/admin/publishing?error=confirm");
  try {
    await setLivePublishing(await getDb(), turnOn);
  } catch {
    redirect("/admin/publishing?error=failed");
  }
  revalidatePath("/admin/publishing");
  redirect(`/admin/publishing?notice=${turnOn ? "live_on" : "live_off"}`);
}

/** Publishes what is due right now, without waiting for the scheduler. Respects the switch. */
export async function runPublisherNowAction(): Promise<FormState> {
  await requirePlatformAdmin();
  try {
    const summary = await dispatchDuePosts();
    revalidatePath("/admin/publishing");
    if (summary.disabled) {
      return { error: "Nothing was sent: live publishing is switched off, or Facebook is not fully set up. See the checks above." };
    }
    return {
      success: true,
      message: `Done. Found ${summary.claimed} due ${summary.claimed === 1 ? "post" : "posts"}: ${summary.published} published, ${summary.retrying} to retry, ${summary.failed} failed, ${summary.uncertain} unclear.`,
    };
  } catch {
    return { error: "The run failed. Check that the Supabase service key is set in your hosting settings." };
  }
}
