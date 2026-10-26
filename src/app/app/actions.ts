"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { firstError, profileSchema } from "@/lib/auth/schemas";
import type { FormState } from "@/lib/auth/form-state";
import { getAppContext } from "@/lib/auth/session";
import { getDb } from "@/lib/data/db";
import { saveOwnPrefs } from "@/lib/data/email";
import { notifyWelcome, runLater } from "@/lib/services/email";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

async function saveProfile(formData: FormData, completeOnboarding: boolean): Promise<FormState> {
  const values = {
    displayName: text(formData.get("displayName")),
    workspaceName: text(formData.get("workspaceName")),
    preferredLanguage: text(formData.get("preferredLanguage")),
    timezone: text(formData.get("timezone")),
  };

  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };

  // The workspace comes from the server-side session, never from the form.
  const ctx = await getAppContext();
  if (!ctx) redirect("/auth/login");

  // Compatibility workaround for Supabase JS type inference across minor versions.
  // The database schema is defined in src/lib/supabase/database.types.ts; runtime queries
  // remain protected by Supabase RLS and the server-side session.
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const failure: FormState = { error: "We could not save your changes. Please try again.", values };

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      preferred_language: parsed.data.preferredLanguage,
      timezone: parsed.data.timezone,
      ...(completeOnboarding && !ctx.profile.onboarded_at
        ? { onboarded_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", ctx.user.id)
    .select("id");
  if (profileError || !profileRows?.length) return failure;

  const { data: workspaceRows, error: workspaceError } = await supabase
    .from("workspaces")
    .update({ name: parsed.data.workspaceName, timezone: parsed.data.timezone })
    .eq("id", ctx.workspace.id)
    .select("id");
  if (workspaceError || !workspaceRows?.length) return failure;

  revalidatePath("/app", "layout");

  // First time through onboarding: send the welcome email after the response (never blocks sign-up).
  if (completeOnboarding && !ctx.profile.onboarded_at) runLater(() => notifyWelcome(ctx.user.id));

  if (completeOnboarding) redirect("/app");
  return { success: true, message: "Saved.", values };
}

export async function completeOnboardingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return saveProfile(formData, true);
}

export async function updateSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return saveProfile(formData, false);
}

/** Email choices on the Settings page. Only the person's own row can be changed. */
export async function updateEmailPreferencesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  if (!ctx) redirect("/auth/login");
  const on = (name: string) => formData.get(name) === "on";
  try {
    await saveOwnPrefs(await getDb(), ctx.user.id, {
      campaign_complete: on("campaign_complete"),
      publish_failures: on("publish_failures"),
      page_alerts: on("page_alerts"),
    });
  } catch {
    return { error: "We could not save your choices. Please try again." };
  }
  revalidatePath("/app/settings");
  return { success: true, message: "Saved." };
}
