"use client";

import { useActionState } from "react";
import { saveProviderAction, testProviderAction } from "@/app/admin/actions";
import { Field, FormMessage, SubmitButton } from "@/components/auth/fields";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
      <Switch
        name="enabled"
        label="Use this provider"
        description={keyDetected ? "Posts can be written by this provider." : "Add the API key first, then turn this on."}
        defaultChecked={enabled}
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
        <Field label="Model" name="model" required maxLength={120} defaultValue={model} />
        <Field label="Priority" name="priority" type="number" min={1} max={999} required defaultValue={priority} hint="Lowest runs first" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} compact>
        Save changes
      </SubmitButton>
    </form>
  );
}

export function ProviderTestForm({ provider, disabled }: { provider: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(testProviderAction, initialFormState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="provider" value={provider} />
      <Button type="submit" variant="secondary" size="sm" className="w-full" disabled={disabled || pending}>
        {pending ? "Testing…" : "Test connection"}
      </Button>
      <p className="text-xs text-ink-500">
        {disabled ? "Add the API key to test." : "Sends one tiny request (about 20 tokens)."}
      </p>
      <FormMessage state={state} />
    </form>
  );
}
