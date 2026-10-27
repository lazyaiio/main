"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/data/db";
import { setWorkspacePlan } from "@/lib/data/plans";

const schema = z.object({ workspaceId: z.string().uuid(), plan: z.string().regex(/^[a-z0-9_]{2,30}$/) });

/** Moves a workspace to another plan (and clears its special limits). */
export async function changePlanAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const parsed = schema.safeParse({ workspaceId: formData.get("workspaceId"), plan: formData.get("plan") });
  if (!parsed.success) redirect("/admin/plans?error=invalid");
  try {
    await setWorkspacePlan(await getDb(), parsed.data.workspaceId, parsed.data.plan, {});
  } catch {
    redirect("/admin/plans?error=failed");
  }
  revalidatePath("/admin/plans");
  redirect("/admin/plans?notice=changed");
}
