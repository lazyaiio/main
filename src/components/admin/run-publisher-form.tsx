"use client";

import { useActionState } from "react";
import { runPublisherNowAction } from "@/app/admin/publishing/actions";
import { FormMessage, SubmitButton } from "@/components/auth/fields";
import type { FormState } from "@/lib/auth/form-state";

export function RunPublisherForm() {
  const [state, formAction, pending] = useActionState(runPublisherNowAction, {} as FormState);
  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Running…" compact>
        Publish due posts now
      </SubmitButton>
    </form>
  );
}
