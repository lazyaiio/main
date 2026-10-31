"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/app/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { Field, FormMessage, SubmitButton } from "./fields";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialFormState);
  return (
    <div className="space-y-5 text-left">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <FormMessage state={state} />
        <SubmitButton pending={pending}>Log in</SubmitButton>
      </form>
      <div className="flex items-center justify-between text-sm">
        <Link href="/auth/forgot-password" className="font-medium text-brand hover:underline">
          Forgot password?
        </Link>
        <Link href="/pricing" className="font-medium text-ink-600 hover:underline">
          Create account
        </Link>
      </div>
    </div>
  );
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialFormState);

  if (state.success) {
    return (
      <div role="status" className="space-y-3 text-center">
        <p className="font-display text-lg font-bold">Check your email</p>
        <p className="text-sm leading-relaxed text-ink-600">{state.message}</p>
        <Link href="/auth/login" className="inline-block text-sm font-medium text-brand hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-left">
      <form action={formAction} className="space-y-4">
        <Field label="Your name" name="displayName" autoComplete="name" required defaultValue={state.values?.displayName} />
        <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters."
        />
        <FormMessage state={state} />
        <p className="text-xs leading-relaxed text-ink-500">
          By creating an account you agree to our{" "}
          <Link href="/terms" target="_blank" className="font-medium text-brand hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-brand hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <SubmitButton pending={pending}>Create account</SubmitButton>
      </form>
      <p className="text-center text-sm text-ink-600">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-medium text-brand hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialFormState);

  if (state.success) {
    return (
      <div role="status" className="space-y-3 text-center">
        <p className="font-display text-lg font-bold">Check your email</p>
        <p className="text-sm leading-relaxed text-ink-600">{state.message}</p>
        <Link href="/auth/login" className="inline-block text-sm font-medium text-brand hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-left">
      <form action={formAction} className="space-y-4">
        <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
        <FormMessage state={state} />
        <SubmitButton pending={pending}>Send reset link</SubmitButton>
      </form>
      <p className="text-center text-sm">
        <Link href="/auth/login" className="font-medium text-ink-600 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialFormState);
  return (
    <form action={formAction} className="space-y-4 text-left">
      <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={8} hint="At least 8 characters." />
      <Field label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Update password</SubmitButton>
    </form>
  );
}
