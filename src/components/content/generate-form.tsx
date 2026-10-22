"use client";

import { useActionState, useState } from "react";
import { generatePostAction } from "@/app/app/content/actions";
import { Field, FormMessage, SelectField, SubmitButton, TextAreaField } from "@/components/auth/fields";
import { initialFormState } from "@/lib/auth/form-state";
import { POST_FORMATS, POST_LENGTHS } from "@/lib/post-formats";
import { TONES } from "@/lib/projects";

export type GenerateProject = {
  id: string;
  name: string;
  languages: string[];
  inputType: string;
  inputValue: string;
};

export function GenerateForm({
  projects,
  defaultProjectId,
  available,
}: {
  projects: GenerateProject[];
  defaultProjectId: string;
  available: boolean;
}) {
  const [state, formAction, pending] = useActionState(generatePostAction, initialFormState);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  const v = state.values;
  const languageOptions = project?.languages ?? ["en"];
  const topicDefault = project?.inputType === "topic" ? project.inputValue.slice(0, 300) : "";

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="field-projectId" className="block text-sm font-medium text-ink-700">
          Project
        </label>
        <select
          id="field-projectId"
          name="projectId"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField key={`lang-${projectId}`} label="Language" name="language" defaultValue={v?.language}>
          {languageOptions.map((code) => (
            <option key={code} value={code}>
              {code === "bn" ? "Bengali" : "English"}
            </option>
          ))}
        </SelectField>
        <SelectField label="Format" name="format" defaultValue={v?.format ?? "tip"}>
          {POST_FORMATS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </SelectField>
      </div>

      <Field
        key={`topic-${projectId}`}
        label="What should this post be about?"
        name="topic"
        required
        maxLength={300}
        defaultValue={v?.topic ?? topicDefault}
        hint={
          project && project.inputType !== "topic"
            ? "Describe the topic in a few words. Automatic reading of links and websites is coming next."
            : "A topic, an idea, or an angle."
        }
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Length" name="length" defaultValue={v?.length ?? "medium"}>
          {POST_LENGTHS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Tone (optional)" name="tone" defaultValue={v?.tone ?? ""}>
          <option value="">No preference</option>
          {TONES.map((tone) => (
            <option key={tone} value={tone}>
              {tone.charAt(0).toUpperCase() + tone.slice(1)}
            </option>
          ))}
        </SelectField>
      </div>

      <Field label="Audience (optional)" name="audience" maxLength={200} defaultValue={v?.audience ?? ""} />
      <Field label="Call to action (optional)" name="cta" maxLength={200} defaultValue={v?.cta ?? ""} hint="For example: Message us to book." />
      <TextAreaField label="Notes for the writer (optional)" name="notes" maxLength={500} defaultValue={v?.notes ?? ""} />

      <FormMessage state={state} />
      <SubmitButton pending={pending || !available} pendingLabel={pending ? "Generating… this can take up to a minute" : "AI is not set up yet"}>
        Generate post
      </SubmitButton>
    </form>
  );
}
