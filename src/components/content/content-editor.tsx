"use client";

import { useActionState, useState } from "react";
import { updateContentAction } from "@/app/app/content/actions";
import { Field, FormMessage, SubmitButton, TextAreaField } from "@/components/auth/fields";
import { initialFormState } from "@/lib/auth/form-state";

export type EditorDefaults = {
  hook: string;
  body: string;
  cta: string;
  hashtags: string;
  imageBrief: string;
};

export function ContentEditor({ itemId, defaults }: { itemId: string; defaults: EditorDefaults }) {
  const [state, formAction, pending] = useActionState(updateContentAction, initialFormState);
  const v = state.values;
  const [length, setLength] = useState((v?.body ?? defaults.body).length);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="itemId" value={itemId} />
      <Field label="Hook (first line)" name="hook" maxLength={300} defaultValue={v?.hook ?? defaults.hook} />
      <div className="space-y-1.5">
        <TextAreaField
          label="Post text"
          name="body"
          rows={10}
          required
          maxLength={10000}
          defaultValue={v?.body ?? defaults.body}
          onChange={(event) => setLength(event.target.value.length)}
        />
        <p className="text-right text-xs text-ink-400">{length.toLocaleString("en-US")} characters</p>
      </div>
      <Field label="Call to action" name="cta" maxLength={300} defaultValue={v?.cta ?? defaults.cta} />
      <Field
        label="Hashtags"
        name="hashtags"
        maxLength={500}
        defaultValue={v?.hashtags ?? defaults.hashtags}
        hint="Separate with spaces or commas. Up to 10."
      />
      <TextAreaField
        label="Image idea"
        name="imageBrief"
        rows={2}
        maxLength={1000}
        defaultValue={v?.imageBrief ?? defaults.imageBrief}
        hint="Describes the picture to use. Image attachment arrives later."
      />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Save changes</SubmitButton>
    </form>
  );
}
