"use client";

import { useActionState } from "react";
import { saveStockAction, testStockAction } from "@/app/admin/stock-photos/actions";
import { Field, FormMessage, SubmitButton } from "@/components/auth/fields";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { initialFormState } from "@/lib/auth/form-state";

export function StockProviderForm({ provider, enabled, source }: { provider: "pexels" | "pixabay" | "unsplash"; enabled: boolean; source: "admin" | "environment" | "none" }) {
  const [state, formAction, pending] = useActionState(saveStockAction, initialFormState);
  const [testState, testAction, testing] = useActionState(testStockAction, initialFormState);
  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="provider" value={provider} />
        <Switch
          name="enabled"
          label="Use this provider"
          description={source === "environment" ? "Its key comes from a Vercel environment variable, so it is always on." : "Turn on after saving a key."}
          defaultChecked={enabled}
          disabled={source === "environment"}
        />
        <Field
          label={source === "admin" ? "Replace API key" : "API key"}
          name={`apiKey-${provider}`}
          type="password"
          autoComplete="off"
          maxLength={200}
          placeholder={source === "admin" ? "A key is saved. Paste a new one to replace it." : "Paste the key here"}
          hint="Saved encrypted. It is never shown again."
        />
        <FormMessage state={state} />
        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={pending} compact>
            Save
          </SubmitButton>
          {source === "admin" ? (
            <Button type="submit" name="intent" value="remove" variant="ghost" size="sm" disabled={pending}>
              Remove key
            </Button>
          ) : null}
        </div>
      </form>
      <form action={testAction} className="space-y-2 border-t border-ink-100 pt-4">
        <input type="hidden" name="provider" value={provider} />
        <Button type="submit" variant="secondary" size="sm" disabled={testing || source === "none"}>
          {testing ? "Testing…" : "Test search"}
        </Button>
        <FormMessage state={testState} />
      </form>
    </div>
  );
}
