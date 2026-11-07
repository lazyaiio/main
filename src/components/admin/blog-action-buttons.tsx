"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";

/**
 * Save / publish / schedule / take offline buttons for the article editor.
 *
 * Each button writes its own action into a hidden field the moment it is clicked, so the server
 * always receives which button was pressed (it no longer depends on the browser sending the
 * clicked button's name). While a request runs, every button is disabled.
 */
export function BlogActionButtons({ live, scheduled }: { live: boolean; scheduled: boolean }) {
  const { pending } = useFormStatus();
  const intent = useRef<HTMLInputElement>(null);
  const pick = (value: string) => () => {
    if (intent.current) intent.current.value = value;
  };
  const primary = "h-10 rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50";
  const outline = "h-10 rounded-xl border border-ink-300 px-5 text-sm font-semibold text-ink hover:bg-ink-50 disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-ink-100 pt-4">
      <input ref={intent} type="hidden" name="intent" defaultValue="save" />
      <button type="submit" onClick={pick("save")} disabled={pending} aria-busy={pending} className={outline}>
        {pending ? "Working…" : "Save draft"}
      </button>
      <button type="submit" onClick={pick("publish")} disabled={pending} className={primary}>
        {live ? "Save and keep published" : "Publish now"}
      </button>
      {live || scheduled ? (
        <button type="submit" onClick={pick("unpublish")} disabled={pending} className={outline}>
          Take offline
        </button>
      ) : null}
      <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        Or schedule (UTC)
        <input type="datetime-local" name="publishAt" className="mt-1 block rounded-xl border border-ink-200 px-3 py-2 text-sm font-normal normal-case text-ink" />
      </label>
      <button type="submit" onClick={pick("schedule")} disabled={pending} className={outline}>
        Schedule
      </button>
    </div>
  );
}
