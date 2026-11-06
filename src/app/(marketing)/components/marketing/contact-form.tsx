"use client";

import { useActionState } from "react";
import { sendContactAction } from "@/app/(marketing)/contact/actions";
import { Field, FormMessage, SelectField, SubmitButton, TextAreaField } from "@/components/auth/fields";
import { initialFormState } from "@/lib/auth/form-state";
import { SUPPORT_TOPICS } from "@/lib/support";

/** The public Contact form. `startedAt` comes from the server so a bot that posts instantly can be spotted. */
export function ContactForm({ startedAt }: { startedAt: number }) {
  const [state, formAction, pending] = useActionState(sendContactAction, initialFormState);
  const v = state.values ?? {};

  if (state.success) {
    return (
      <div role="status" className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-emerald-800">
        <p className="font-semibold">Message sent</p>
        <p className="mt-1 text-sm">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" name="name" autoComplete="name" required maxLength={80} defaultValue={v.name} />
        <Field label="Your email" name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={v.email} hint="We reply to this address." />
      </div>
      <SelectField label="What is this about?" name="topic" defaultValue={v.topic || "support"}>
        {SUPPORT_TOPICS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </SelectField>
      <Field label="Subject (optional)" name="subject" maxLength={120} defaultValue={v.subject} />
      <TextAreaField
        label="Your message"
        name="message"
        rows={6}
        required
        minLength={10}
        maxLength={4000}
        defaultValue={v.message}
        hint="Tell us what you clicked and what you saw. Never include a password."
      />
      {/* Hidden from people. Bots that fill in every box give themselves away. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="field-website">Leave this field empty</label>
        <input id="field-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <input type="hidden" name="startedAt" value={startedAt} />
      <SubmitButton pending={pending} pendingLabel="Sending…">
        Send message
      </SubmitButton>
    </form>
  );
}
