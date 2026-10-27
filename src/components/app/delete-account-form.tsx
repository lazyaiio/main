"use client";

import { useActionState } from "react";
import { deleteAccountAction } from "@/app/app/account-actions";
import { Field, FormMessage, SubmitButton } from "@/components/auth/fields";
import type { FormState } from "@/lib/auth/form-state";

/** Permanent deletion. Asks for the password and the word DELETE. */
export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteAccountAction, {} as FormState);
  return (
    <form action={formAction} className="space-y-4">
      <Field label="Your password" name="password" type="password" autoComplete="current-password" required maxLength={200} />
      <Field label="Type DELETE to confirm" name="confirm" autoComplete="off" required maxLength={10} hint="Capital letters, exactly: DELETE" />
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Deleting…" compact>
        Delete my account permanently
      </SubmitButton>
    </form>
  );
}
