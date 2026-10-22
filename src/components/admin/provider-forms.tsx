"use client";

import { useActionState } from "react";
import { saveProviderAction, testProviderAction } from "@/app/admin/actions";
import { Field, FormMessage, SubmitButton } from "@/components/auth/fields";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/form-state";

export function ProviderSettingsForm({
  provider,
  enabled,
  model,
  priority,
  keyDetected,
}: {
  provider: string;
  enabled: boolean;
  model: string;
  priority: number;
  keyDetected: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveProviderAction, initialFormState);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="provider" value={provider} />
      <label className="flex items-center gap-3 text-sm font-medium">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="h-4 w-4 accent-brand" />
        Active
        {!keyDetected ? <span className="text-xs font-normal text-amber-700">(needs an API key first)</span> : null}
      </label>
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Field label="Model" name="model" required maxLength={120} defaultValue={model} />
        <Field label="Priority" name="priority" type="number" min={1} max={999} required defaultValue={priority} hint="Lowest goes first" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Save</SubmitButton>
    </form>
  );
}

export function ProviderTestForm({ provider, disabled }: { provider: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(testProviderAction, initialFormState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="provider" value={provider} />
      <Button type="submit" variant="secondary" size="sm" disabled={disabled || pending}>
        {pending ? "Testing…" : "Test connection"}
      </Button>
      <p className="text-xs text-ink-500">Sends one tiny request (about 20 tokens).</p>
      <FormMessage state={state} />
    </form>
  );
}
