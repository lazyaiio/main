"use client";

import Link from "next/link";
import { useActionState } from "react";
import { checkoutSignUpAction } from "@/app/(marketing)/checkout/actions";
import { Field, FormMessage, SubmitButton } from "@/components/auth/fields";
import { initialFormState } from "@/lib/auth/form-state";

export function CheckoutSignupForm({ plan, period, paid, amountLabel }: { plan: string; period: string; paid: boolean; amountLabel: string | null }) {
  const [state, formAction, pending] = useActionState(checkoutSignUpAction, initialFormState);

  if (state.success) {
    return (
      <div role="status" className="space-y-3 text-center">
        <p className="font-display text-lg font-bold">Check your email</p>
        <p className="text-sm leading-relaxed text-ink-600">{state.message}</p>
        <Link href="/auth/login" className="inline-block text-sm font-medium text-brand hover:underline">
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 text-left">
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="period" value={period} />
      <Field label="Your name" name="displayName" autoComplete="name" required defaultValue={state.values?.displayName} />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
      <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} hint="At least 8 characters." />
      <label className="flex items-start gap-2.5 text-sm text-ink-700">
        <input type="checkbox" name="acceptTerms" required className="mt-0.5 h-4 w-4 accent-brand" />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="font-medium text-brand hover:underline">
            Terms of Service
          </Link>{" "}
          and the{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-brand hover:underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel={paid ? "Taking you to bKash…" : "Creating your account…"}>
        {paid ? `Create account and pay ${amountLabel ?? ""} with bKash` : "Create free account"}
      </SubmitButton>
      <p className="text-xs text-ink-500">
        After you create the account we email you a link to verify your address. You can start right away, and everything is unlocked once you open the link.
      </p>
    </form>
  );
}
