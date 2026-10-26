"use client";

import { useActionState } from "react";
import { updateEmailPreferencesAction } from "@/app/app/actions";
import { FormMessage, SubmitButton } from "@/components/auth/fields";
import type { FormState } from "@/lib/auth/form-state";

type Prefs = { campaign_complete: boolean; publish_failures: boolean; page_alerts: boolean; suppressed: boolean };

const OPTIONS: { name: keyof Omit<Prefs, "suppressed">; label: string; hint: string }[] = [
  { name: "campaign_complete", label: "Campaign finished", hint: "When a campaign has finished writing its posts." },
  { name: "publish_failures", label: "Post could not be published", hint: "When a scheduled post fails or its result is unclear." },
  { name: "page_alerts", label: "Facebook Page needs attention", hint: "When a Page must be reconnected." },
];

export function EmailPreferencesForm({ prefs }: { prefs: Prefs }) {
  const [state, formAction, pending] = useActionState(updateEmailPreferencesAction, {} as FormState);
  return (
    <form action={formAction} className="space-y-4">
      {prefs.suppressed ? (
        <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          Your email provider reported a problem delivering to your address (a bounce or a spam complaint), so notification emails are paused. Contact us if this is a mistake.
        </p>
      ) : null}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-ink-700">Send me an email when…</legend>
        {OPTIONS.map((option) => (
          <label key={option.name} className="flex items-start gap-3 text-sm">
            <input type="checkbox" name={option.name} defaultChecked={prefs[option.name]} className="mt-0.5 h-4 w-4 accent-brand" />
            <span>
              <span className="block font-medium text-ink">{option.label}</span>
              <span className="block text-xs text-ink-500">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-ink-500">Account and security emails (such as password resets) are always sent.</p>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Saving…" compact>
        Save email choices
      </SubmitButton>
    </form>
  );
}
