"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth/form-state";
import { getAppContext } from "@/lib/auth/session";
import { ServiceError } from "@/lib/services/errors";
import { deleteAccount } from "@/lib/services/account";
import { createClient } from "@/lib/supabase/server";

/** Permanent. Needs the password and the word DELETE typed exactly. */
export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  if (!ctx) redirect("/auth/login");

  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0 || password.length > 200) return { error: "Enter your password." };
  if (formData.get("confirm") !== "DELETE") return { error: "Type DELETE in capital letters to confirm." };

  try {
    await deleteAccount(ctx, { password });
  } catch (error) {
    return { error: error instanceof ServiceError ? error.message : "Something went wrong. Please try again." };
  }
  // The account is gone; clear the browser's session and go to the home page.
  try {
    await (await createClient()).auth.signOut();
  } catch {
    // The session is already invalid.
  }
  redirect("/?account=deleted");
}
