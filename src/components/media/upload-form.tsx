"use client";

import { useActionState } from "react";
import { uploadImageAction } from "@/app/app/media/actions";
import { Field, FormMessage, SubmitButton } from "@/components/auth/fields";
import type { FormState } from "@/lib/auth/form-state";
import { MAX_ALT_LENGTH, MAX_CREDIT_LENGTH, UPLOAD_ACCEPT } from "@/lib/media/limits";

/** Upload a JPG, PNG, WebP, or GIF (up to 4 MB). With attachTo, the new image is added to that post. */
export function UploadForm({ attachTo }: { attachTo?: string }) {
  const [state, formAction, pending] = useActionState(uploadImageAction, {} as FormState);

  return (
    <form action={formAction} className="space-y-4">
      {attachTo ? <input type="hidden" name="attachTo" value={attachTo} /> : null}

      <div className="space-y-1.5">
        <label htmlFor="field-file" className="block text-sm font-medium text-ink-700">
          Image file
        </label>
        <input
          id="field-file"
          name="file"
          type="file"
          accept={UPLOAD_ACCEPT}
          required
          aria-describedby="field-file-hint"
          className="block w-full rounded-xl border border-dashed border-ink-300 bg-white px-3.5 py-3 text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700"
        />
        <p id="field-file-hint" className="text-xs text-ink-500">
          JPG, PNG, WebP, or GIF, up to 4 MB and 8,000 pixels on the longest side.
        </p>
      </div>

      <Field
        label="Alt text (recommended)"
        name="altText"
        maxLength={MAX_ALT_LENGTH}
        hint="Describe the image in one sentence for people who use screen readers."
      />
      <Field label="Credit or source (optional)" name="credit" maxLength={MAX_CREDIT_LENGTH} hint="For example: Photo by Sam Lee." />

      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Uploading…" compact>
        {attachTo ? "Upload and use on this post" : "Upload image"}
      </SubmitButton>
    </form>
  );
}
