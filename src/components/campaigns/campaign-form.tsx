"use client";

import { useActionState, useState, type ReactNode } from "react";
import { planCampaignAction, type PlanFormState, type PlanPreviewRow } from "@/app/app/campaigns/actions";
import { Field, FormMessage, SelectField, TextAreaField } from "@/components/auth/fields";
import { Button } from "@/components/ui/button";
import { formatPlanDate, formatPlanTime } from "@/lib/campaign-format";
import { DURATION_PRESETS, TIME_CHOICES, WEEKDAYS } from "@/lib/campaign-options";
import { POST_FORMATS, POST_LENGTHS, formatLabel } from "@/lib/post-formats";
import { TONES, languageLabel } from "@/lib/projects";

export type CampaignFormProject = {
  id: string;
  name: string;
  languages: ("en" | "bn")[];
  inputType: string;
  inputValue: string;
};

const DEFAULT_FORMATS = ["tip", "checklist", "question", "myth_vs_fact", "how_to", "educational", "discussion"];
const DEFAULT_DAYS = ["1", "2", "3", "4", "5"];
const DEFAULT_TIMES = ["10:00"];

/** Restores a checkbox group from the echoed form values (React resets uncontrolled fields after a submit). */
function restore(values: Record<string, string> | undefined, key: string, fallback: string[]): string[] {
  if (!values) return fallback; // first visit: use the defaults
  const value = values[key];
  return value ? value.split(",") : []; // a missing key after a submit means nothing was checked
}

function CheckGroup({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink-700">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
      {hint ? <p className="text-xs text-ink-500">{hint}</p> : null}
    </fieldset>
  );
}

function Check({ name, value, label, defaultChecked }: { name: string; value: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink has-[:checked]:border-brand has-[:checked]:bg-brand-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/30">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="h-4 w-4 accent-brand" />
      {label}
    </label>
  );
}

function PlanPreview({ rows }: { rows: PlanPreviewRow[] }) {
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.language] = (acc[row.language] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <section aria-label="Proposed calendar" className="space-y-3 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Proposed calendar</h2>
        <p className="text-sm text-ink-500">
          {rows.length} {rows.length === 1 ? "post" : "posts"}
          {Object.entries(counts).map(([language, count]) => ` · ${count} ${languageLabel(language as "en" | "bn")}`)}
        </p>
      </div>
      <div className="max-h-96 overflow-auto rounded-xl border border-ink-100">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="sticky top-0 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th scope="col" className="px-3 py-2">#</th>
              <th scope="col" className="px-3 py-2">Date</th>
              <th scope="col" className="px-3 py-2">Time</th>
              <th scope="col" className="px-3 py-2">Language</th>
              <th scope="col" className="px-3 py-2">Format</th>
              <th scope="col" className="px-3 py-2">Angle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((row) => (
              <tr key={row.index}>
                <td className="px-3 py-2 text-ink-500">{row.index + 1}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatPlanDate(row.localDate)}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatPlanTime(row.localTime)}</td>
                <td className="px-3 py-2">{languageLabel(row.language)}</td>
                <td className="px-3 py-2">{formatLabel(row.format)}</td>
                <td className="px-3 py-2 text-ink-600">{row.theme ?? "Chosen by the AI"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-500">
        Times are in your workspace timezone. Nothing is written yet: after you create the campaign, you press Start and the AI
        writes the posts in small batches.
      </p>
    </section>
  );
}

export function CampaignForm({
  projects,
  defaultProjectId,
  defaultStartDate,
  available,
}: {
  projects: CampaignFormProject[];
  defaultProjectId: string;
  defaultStartDate: string;
  available: boolean;
}) {
  const initial: PlanFormState = {};
  const [state, formAction, pending] = useActionState(planCampaignAction, initial);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  const v = state.values;

  const languageOptions = project?.languages ?? ["en"];
  const topicDefault = project?.inputType === "topic" ? project.inputValue.slice(0, 300) : "";
  const sourceDefault = project?.inputType === "url" ? project.inputValue : "";
  const chosenLanguages = restore(v, "languages", languageOptions);
  const chosenFormats = restore(v, "formats", DEFAULT_FORMATS);
  const chosenDays = restore(v, "postingDays", DEFAULT_DAYS);
  const chosenTimes = restore(v, "times", DEFAULT_TIMES);

  return (
    <form action={formAction} className="space-y-6">
      <section className="space-y-5 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">What is this campaign about?</h2>
        <Field label="Campaign name" name="name" maxLength={120} required defaultValue={v?.name ?? ""} hint="For example: November tips." />

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

        <Field
          key={`topic-${projectId}`}
          label="Topic"
          name="topic"
          maxLength={300}
          defaultValue={v?.topic ?? topicDefault}
          hint="The subject all posts are about. You can leave this empty when you paste an article link."
        />
        <Field
          key={`source-${projectId}`}
          label="Article link (optional)"
          name="sourceUrl"
          type="url"
          maxLength={2000}
          defaultValue={v?.sourceUrl ?? sourceDefault}
          hint="We read the page once and write original posts about it, each with a link back. Pages that need a login or are behind a paywall cannot be read."
        />
        <TextAreaField
          label="Angles (optional)"
          name="themes"
          rows={4}
          maxLength={2400}
          defaultValue={v?.themes ?? ""}
          hint="One idea per line, up to 20. They are used in order and repeated. Leave empty and the AI varies the posts itself."
        />
      </section>

      <section className="space-y-5 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Schedule</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Start date" name="startDate" type="date" required defaultValue={v?.startDate ?? defaultStartDate} />
          <SelectField label="Duration" name="durationDays" defaultValue={v?.durationDays ?? "30"}>
            {DURATION_PRESETS.map((days) => (
              <option key={days} value={days}>
                {days} days
              </option>
            ))}
          </SelectField>
          <Field
            label="Number of posts"
            name="itemCount"
            type="number"
            inputMode="numeric"
            min={1}
            max={90}
            required
            defaultValue={v?.itemCount ?? "12"}
            hint="1 to 90."
          />
        </div>

        <CheckGroup legend="Posting days">
          {WEEKDAYS.map((day) => (
            <Check key={day.value} name="postingDays" value={String(day.value)} label={day.short} defaultChecked={chosenDays.includes(String(day.value))} />
          ))}
        </CheckGroup>

        <CheckGroup legend="Posting times" hint="Up to 4 per day, in your workspace timezone. With several times, a day can hold several posts.">
          {TIME_CHOICES.map((time) => (
            <Check key={time.value} name="times" value={time.value} label={time.label} defaultChecked={chosenTimes.includes(time.value)} />
          ))}
        </CheckGroup>
      </section>

      <section className="space-y-5 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Style</h2>

        <CheckGroup
          key={`languages-${projectId}`}
          legend="Languages"
          hint="With two languages, posts alternate between them, and each pair shares a format and an angle."
        >
          {languageOptions.map((code) => (
            <Check key={code} name="languages" value={code} label={languageLabel(code)} defaultChecked={chosenLanguages.includes(code)} />
          ))}
        </CheckGroup>

        <CheckGroup legend="Post formats" hint="The AI rotates through the formats you choose.">
          {POST_FORMATS.map((format) => (
            <Check key={format.value} name="formats" value={format.value} label={format.label} defaultChecked={chosenFormats.includes(format.value)} />
          ))}
        </CheckGroup>

        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Length" name="length" defaultValue={v?.length ?? "medium"}>
            {POST_LENGTHS.map((length) => (
              <option key={length.value} value={length.value}>
                {length.label}
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
      </section>

      <FormMessage state={state} />
      {state.preview && state.preview.length > 0 ? <PlanPreview rows={state.preview} /> : null}

      {!available ? (
        <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          AI generation is not set up yet. You can still plan and save a campaign, but it cannot start until an admin adds an API key.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" name="intent" value="preview" variant="secondary" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? "Working…" : "Preview calendar"}
        </Button>
        <Button type="submit" name="intent" value="create" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? "Working…" : "Create campaign"}
        </Button>
        <p className="text-xs text-ink-500">Creating a campaign does not use AI. You start the writing on the next page.</p>
      </div>
    </form>
  );
}
