"use client";

import { useActionState } from "react";
import { CheckboxGroup, Field, FormMessage, SelectField, SubmitButton, TextAreaField } from "@/components/auth/fields";
import { initialFormState, type FormState } from "@/lib/auth/form-state";
import { PROJECT_TYPES, TONES } from "@/lib/projects";

export type ProjectFormDefaults = {
  name: string;
  inputType: string;
  inputValue: string;
  languages: string[];
  audience: string;
  tone: string;
  notes: string;
};

export const emptyProjectDefaults: ProjectFormDefaults = {
  name: "",
  inputType: "topic",
  inputValue: "",
  languages: ["en"],
  audience: "",
  tone: "",
  notes: "",
};

export function ProjectForm({
  action,
  submitLabel,
  defaults,
  projectId,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  defaults: ProjectFormDefaults;
  projectId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const v = state.values;
  const languages = v?.languages !== undefined ? v.languages.split(",").filter(Boolean) : defaults.languages;

  return (
    <form action={formAction} className="space-y-5">
      {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}
      <Field label="Project name" name="name" required maxLength={120} defaultValue={v?.name ?? defaults.name} />
      <SelectField label="Start from" name="inputType" defaultValue={v?.inputType ?? defaults.inputType}>
        {PROJECT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </SelectField>
      <Field
        label="Topic or web address"
        name="inputValue"
        required
        maxLength={2000}
        defaultValue={v?.inputValue ?? defaults.inputValue}
        hint="A short topic, or a full address such as https://example.com"
      />
      <CheckboxGroup
        legend="Write in"
        name="languages"
        selected={languages}
        options={[
          { value: "en", label: "English" },
          { value: "bn", label: "বাংলা (Bengali)" },
        ]}
      />
      <Field
        label="Audience (optional)"
        name="audience"
        maxLength={200}
        defaultValue={v?.audience ?? defaults.audience}
        hint="Who are the posts for?"
      />
      <SelectField label="Tone (optional)" name="tone" defaultValue={v?.tone ?? defaults.tone}>
        <option value="">No preference</option>
        {TONES.map((tone) => (
          <option key={tone} value={tone}>
            {tone.charAt(0).toUpperCase() + tone.slice(1)}
          </option>
        ))}
      </SelectField>
      <TextAreaField
        label="Notes for the writer (optional)"
        name="notes"
        maxLength={500}
        defaultValue={v?.notes ?? defaults.notes}
        hint="Brand voice, words to use or avoid."
      />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}
