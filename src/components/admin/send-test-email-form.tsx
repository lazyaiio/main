"use client";

import { useActionState } from "react";
import { sendTestEmailAction } from "@/app/admin/email/actions";
import { FormMessage, SubmitButton } from "@/components/auth/fields";
import type { FormState } from "@/lib/auth/form-state";

export function SendTestEmailForm() {
  const [state, formAction, pending] = useActionState(sendTestEmailAction, {} as FormState);
  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Sending…" compact>
        Send a test email to me
      </SubmitButton>
    </form>
  );
}
