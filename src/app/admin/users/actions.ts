"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { DataError } from "@/lib/data/db";
import { ServiceError } from "@/lib/services/errors";
import { changeUserPlan, restoreUser, suspendUser } from "@/lib/services/users";

const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
};

/** Goes back to the list (keeping the search and page) with a notice or an error. */
function back(formData: FormData, kind: "notice" | "error", message: string): never {
  const params = new URLSearchParams();
  const q = field(formData, "q").slice(0, 80);
  const page = field(formData, "page").replace(/\D/g, "").slice(0, 5);
  if (q) params.set("q", q);
  if (page && page !== "1") params.set("page", page);
  params.set(kind, message);
  redirect(`/admin/users?${params.toString()}`);
}

const messageOf = (error: unknown, fallback: string) => (error instanceof ServiceError || error instanceof DataError ? error.message : fallback);

export async function changePlanAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  try {
    await changeUserPlan({ workspaceId: field(formData, "workspaceId"), plan: field(formData, "plan"), period: field(formData, "period"), endsOn: field(formData, "endsOn") });
  } catch (error) {
    back(formData, "error", messageOf(error, "Could not change the plan."));
  }
  revalidatePath("/admin/users");
  back(formData, "notice", "Plan changed. It applies right away.");
}

export async function suspendAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  let blocked = true;
  try {
    blocked = (await suspendUser(ctx.user.id, field(formData, "userId"), field(formData, "reason"))).signInBlocked;
  } catch (error) {
    back(formData, "error", messageOf(error, "Could not suspend the account."));
  }
  revalidatePath("/admin/users");
  back(formData, "notice", blocked ? "Account suspended. The person cannot sign in or change anything." : "Account suspended in LazyAI (nothing can be created or changed), but Supabase did not block sign-in. Check the Supabase service key.");
}

export async function restoreAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  try {
    await restoreUser(ctx.user.id, field(formData, "userId"));
  } catch (error) {
    back(formData, "error", messageOf(error, "Could not restore the account."));
  }
  revalidatePath("/admin/users");
  back(formData, "notice", "Account restored.");
}
