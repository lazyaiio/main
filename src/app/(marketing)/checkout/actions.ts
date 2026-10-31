"use server";

import { redirect } from "next/navigation";
import { firstError, signUpSchema } from "@/lib/auth/schemas";
import type { FormState } from "@/lib/auth/form-state";
import { getAppContext } from "@/lib/auth/session";
import { getPersonalWorkspaceId } from "@/lib/data/payments";
import { listVisiblePlans } from "@/lib/data/plans";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";
import { isPeriod, priceFor } from "@/lib/payments/billing";
import { createClient } from "@/lib/supabase/server";
import { beginPayment, paymentsAvailable } from "@/lib/services/billing";
import { sendVerificationEmail } from "@/lib/services/email-verification";
import { ServiceError } from "@/lib/services/errors";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

/**
 * Creates the account and continues: a free plan goes to the dashboard, a paid plan goes to bKash.
 * The plan and the price are read here from the database. Nothing about money comes from the browser.
 */
export async function checkoutSignUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { displayName: text(formData.get("displayName")), email: text(formData.get("email")) };
  if (!isSupabaseConfigured()) return { error: "Sign-up is not set up on this site yet. Please try again later.", values };

  const planKey = text(formData.get("plan"));
  const periodRaw = formData.get("period");
  const period = isPeriod(periodRaw) ? periodRaw : "monthly";
  if (!/^[a-z0-9_]{2,30}$/.test(planKey)) redirect("/pricing");

  const plan = (await listVisiblePlans().catch(() => [])).find((p) => p.key === planKey);
  if (!plan) redirect("/pricing");
  const paid = plan.key !== "free" && plan.price_monthly !== 0;
  if (paid) {
    const amount = priceFor({ key: plan.key, priceMonthly: plan.price_monthly, priceYearly: plan.price_yearly, priceLifetime: plan.price_lifetime, lifetimeAvailable: plan.lifetime_available }, period);
    if (amount === null) redirect("/pricing");
    if (!(await paymentsAvailable())) return { error: "Online payment is not open yet. You can start with the free plan for now.", values };
  }

  if (await getAppContext()) redirect(`/checkout?plan=${encodeURIComponent(plan.key)}&period=${period}`); // already signed in

  if (formData.get("acceptTerms") !== "on") return { error: "Please agree to the Terms of Service and the Privacy Policy.", values };
  const parsed = signUpSchema.safeParse({ ...values, password: text(formData.get("password")) });
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName }, emailRedirectTo: `${getPublicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=/app` },
  });
  if (error) {
    if (error.code === "weak_password") return { error: "That password is too easy to guess. Try a longer or less common one.", values };
    if (error.code === "user_already_exists") return { error: "An account with this email already exists. Log in first, then choose your plan on the Billing page.", values };
    return { error: "We could not create your account. Please try again.", values };
  }
  // Supabase may hide a repeated sign-up (no error, no new session). Treat "no user" as a failure.
  if (!data.user) return { error: "We could not create your account. Please try again.", values };

  if (!data.session) {
    // The project still asks Supabase to confirm the email before signing in, so we cannot continue to payment yet.
    return { success: true, message: "Check your email. We sent you a link to confirm your account. After that, log in and choose your plan on the Billing page.", values };
  }

  await sendVerificationEmail(data.user.id);

  if (!paid) redirect("/app?notice=welcome");

  const workspaceId = await getPersonalWorkspaceId(data.user.id);
  if (!workspaceId) redirect("/app?notice=welcome");
  let url: string;
  try {
    url = await beginPayment({ userId: data.user.id, workspaceId }, plan.key, period);
  } catch (e) {
    const code = e instanceof ServiceError ? e.kind : "failed";
    // The account exists; the payment can be tried again from Billing.
    redirect(`/app/billing?error=${encodeURIComponent(code)}&plan=${encodeURIComponent(plan.key)}`);
  }
  redirect(url);
}
