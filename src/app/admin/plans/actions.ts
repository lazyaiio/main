"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/data/db";
import { setBillingCurrency, setWorkspacePlan, updatePlanDetails } from "@/lib/data/plans";
import { LIMIT_KEYS } from "@/lib/plans";
import { isCurrency, parseFeatureLines, parseLimitField, parsePriceField } from "@/lib/pricing";

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

const textField = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
};

/** Saves the name, prices, feature list, flags and limits of one plan. */
export async function updatePlanAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const key = z.string().regex(/^[a-z0-9_]{2,30}$/).safeParse(formData.get("key"));
  const name = textField(formData, "name").trim();
  const tagline = textField(formData, "tagline").trim();
  const priceMonthly = parsePriceField(textField(formData, "priceMonthly"));
  const priceYearly = parsePriceField(textField(formData, "priceYearly"));
  if (!key.success || name.length < 1 || name.length > 60 || tagline.length > 160 || priceMonthly === undefined || priceYearly === undefined) {
    redirect("/admin/plans?error=invalid");
  }
  const limits: Record<string, number> = {};
  for (const limitKey of LIMIT_KEYS) {
    const parsed = parseLimitField(textField(formData, `limit_${limitKey}`));
    // Every limit needs a number. (A missing limit would fall back to the Free plan's number in the database.
    // For "practically unlimited", enter a very large number.) Image storage is typed in megabytes.
    if (parsed === undefined || parsed === null || (limitKey === "media_bytes" && parsed > 1_000_000_000)) redirect("/admin/plans?error=invalid");
    limits[limitKey] = limitKey === "media_bytes" ? parsed * 1024 * 1024 : parsed;
  }
  try {
    await updatePlanDetails({
      key: key.data,
      name,
      tagline,
      priceMonthly,
      priceYearly,
      features: parseFeatureLines(textField(formData, "features")),
      highlighted: formData.get("highlighted") === "on",
      visible: formData.get("visible") === "on",
      limits,
    });
  } catch {
    redirect("/admin/plans?error=failed");
  }
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  redirect("/admin/plans?notice=saved");
}

export async function updateCurrencyAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const currency = formData.get("currency");
  if (!isCurrency(currency)) redirect("/admin/plans?error=invalid");
  try {
    await setBillingCurrency(currency, ctx.user.id);
  } catch {
    redirect("/admin/plans?error=failed");
  }
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  redirect("/admin/plans?notice=saved");
}
