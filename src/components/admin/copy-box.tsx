"use client";

import { useState } from "react";

/** A read-only block of text with a Copy button. */
export function CopyBox({ label, text, rows = 5 }: { label: string; text: string; rows?: number }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The text is selectable, so it can still be copied by hand.
    }
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-semibold text-ink" htmlFor={`copy-${label}`}>{label}</label>
        <button type="button" onClick={copy} className="rounded-lg border border-ink-200 bg-white px-3 py-1 text-xs font-semibold text-ink hover:bg-ink-50">{copied ? "Copied" : "Copy"}</button>
      </div>
      <textarea id={`copy-${label}`} readOnly value={text} rows={rows} className="mt-1 block w-full rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-sm leading-6 text-ink" />
    </div>
  );
}
