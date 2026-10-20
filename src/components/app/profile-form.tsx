"use client";

import { useActionState } from "react";
import { Field, FormMessage, SelectField, SubmitButton } from "@/components/auth/fields";
import { initialFormState, type FormState } from "@/lib/auth/form-state";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  timezones: string[];
  defaults: {
    displayName: string;
    workspaceName: string;
    preferredLanguage: "en" | "bn";
    timezone: string;
  };
};

export function ProfileForm({ action, submitLabel, timezones, defaults }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const v = state.values;

  return (
    <form action={formAction} className="space-y-4 text-left">
      <Field label="Your name" name="displayName" autoComplete="name" required defaultValue={v?.displayName ?? defaults.displayName} />
      <Field label="Workspace name" name="workspaceName" required defaultValue={v?.workspaceName ?? defaults.workspaceName} />
      <SelectField label="Content language" name="preferredLanguage" defaultValue={v?.preferredLanguage ?? defaults.preferredLanguage}>
        <option value="en">English</option>
        <option value="bn">বাংলা (Bengali)</option>
      </SelectField>
      <SelectField label="Timezone" name="timezone" defaultValue={v?.timezone ?? defaults.timezone}>
        {timezones.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </SelectField>
      <FormMessage state={state} />
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}
