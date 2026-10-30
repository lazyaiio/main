"use client";

import { useActionState } from "react";
import { saveBkashAction, testBkashAction } from "@/app/admin/payments/actions";
import { Field, FormMessage, SubmitButton } from "@/components/auth/fields";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { initialFormState } from "@/lib/auth/form-state";

export function BkashForm({ enabled, mode, saved }: { enabled: boolean; mode: "sandbox" | "live"; saved: boolean }) {
  const [state, formAction, pending] = useActionState(saveBkashAction, initialFormState);
  const [testState, testAction, testing] = useActionState(testBkashAction, initialFormState);
  const secret = (name: string, label: string, type: "text" | "password") => (
    <Field label={label} name={name} type={type} autoComplete="off" maxLength={300} placeholder={saved ? "Saved. Paste a new value to replace it." : ""} />
  );
  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {secret("appKey", "App Key", "password")}
          {secret("appSecret", "App Secret", "password")}
          {secret("username", "Username", "text")}
          {secret("password", "Password", "password")}
        </div>
        <p className="text-xs text-ink-500">Saved encrypted and never shown again. Leave a box empty to keep what is saved.</p>
        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-500">
          Mode
          <select name="mode" defaultValue={mode} className="mt-1 block rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink">
            <option value="sandbox">Sandbox (test money, safe)</option>
            <option value="live">Live (real money)</option>
          </select>
        </label>
        <Field label="Type LIVE to confirm (only when switching to live)" name="confirmLive" maxLength={10} autoComplete="off" />
        <Switch name="enabled" label="Accept bKash payments" description="When off, nobody can start a payment." defaultChecked={enabled} />
        <FormMessage state={state} />
        <SubmitButton pending={pending} compact>
          Save
        </SubmitButton>
      </form>
      <form action={testAction} className="space-y-2 border-t border-ink-100 pt-4">
        <Button type="submit" variant="secondary" size="sm" disabled={testing || !saved}>
          {testing ? "Testing…" : "Test connection"}
        </Button>
        <FormMessage state={testState} />
      </form>
    </div>
  );
}
