"use server";

import { redirect } from "next/navigation";
import { firstError, forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/lib/auth/schemas";
import type { FormState } from "@/lib/auth/form-state";
import { safeInternalPath } from "@/lib/auth/redirects";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const NOT_CONFIGURED: FormState = {
  error: "Sign-in is not set up on this site yet. Please try again later.",
};

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { displayName: text(formData.get("displayName")), email: text(formData.get("email")) };
  if (!isSupabaseConfigured()) return { ...NOT_CONFIGURED, values };

  const parsed = signUpSchema.safeParse({ ...values, password: text(formData.get("password")) });
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${getPublicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { error: "That password is too easy to guess. Try a longer or less common one.", values };
    }
    if (error.code === "user_already_exists") {
      return { error: "An account with this email already exists. Try logging in instead.", values };
    }
    return { error: "We could not create your account. Please try again.", values };
  }

  if (data.session) redirect("/onboarding");

  return {
    success: true,
    message: "Check your email. We sent you a link to confirm your account.",
    values,
  };
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: text(formData.get("email")) };
  if (!isSupabaseConfigured()) return { ...NOT_CONFIGURED, values };

  const parsed = signInSchema.safeParse({ ...values, password: text(formData.get("password")) });
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Please confirm your email first. Check your inbox for the link.", values };
    }
    return { error: "Incorrect email or password.", values };
  }

  return redirect(safeInternalPath(formData.get("next")));
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/auth/login");
}

export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = { email: text(formData.get("email")) };
  if (!isSupabaseConfigured()) return { ...NOT_CONFIGURED, values };

  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getPublicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/reset-password`,
  });

  // Same answer whether or not the email exists, so accounts cannot be discovered.
  return {
    success: true,
    message: "If an account exists for that email, a reset link is on its way.",
    values,
  };
}

export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const parsed = resetPasswordSchema.safeParse({
    password: text(formData.get("password")),
    confirmPassword: text(formData.get("confirmPassword")),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "This reset link has expired. Please request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: "We could not update your password. Please try again or request a new link." };
  }

  return redirect("/app");
}
