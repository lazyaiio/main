"use client";

import { useActionState } from "react";
import { createManualPostAction } from "@/app/app/content/actions";
import { FormMessage, SelectField, SubmitButton, TextAreaField } from "@/components/auth/fields";
import { initialFormState } from "@/lib/auth/form-state";

export function ManualForm({ projects, defaultProjectId }: { projects: { id: string; name: string }[]; defaultProjectId: string }) {
  const [state, formAction, pending] = useActionState(createManualPostAction, initialFormState);
  const v = state.values;
  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Project (optional)" name="projectId" defaultValue={v?.projectId ?? defaultProjectId}>
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Language" name="language" defaultValue={v?.language ?? "en"}>
          <option value="en">English</option>
          <option value="bn">Bengali</option>
        </SelectField>
      </div>
      <TextAreaField label="Post text" name="body" rows={6} required maxLength={10000} defaultValue={v?.body ?? ""} />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Create draft</SubmitButton>
    </form>
  );
}
