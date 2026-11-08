"use client";

import { useMemo, useState } from "react";
import { cleanHashtags, type HashtagStyle } from "@/lib/tools/hashtags";

export function HashtagTool() {
  const [text, setText] = useState("");
  const [style, setStyle] = useState<HashtagStyle>("camel");
  const [max, setMax] = useState(0);
  const [copied, setCopied] = useState(false);
  const r = useMemo(() => cleanHashtags(text, style, max), [text, style, max]);
  const select = "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

  async function copy() {
    try {
      await navigator.clipboard.writeText(r.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The tags are selectable, so they can still be copied by hand.
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <label htmlFor="tag-text" className="text-sm font-medium text-ink-700">Paste your hashtags or keywords</label>
        <textarea id="tag-text" value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={20000} placeholder="#Bakery, #fresh bread #bakery  small business" className="mt-2 block w-full rounded-xl border border-ink-200 px-3 py-2.5 text-sm leading-6 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="tag-style" className="text-sm font-medium text-ink-700">Style</label><select id="tag-style" value={style} onChange={(e) => setStyle(e.target.value as HashtagStyle)} className={select}><option value="camel">Capitalize each word (#FreshBread)</option><option value="lower">All lowercase (#freshbread)</option><option value="keep">Keep my letters (#freshbread)</option></select></div>
          <div><label htmlFor="tag-max" className="text-sm font-medium text-ink-700">Keep at most</label><select id="tag-max" value={max} onChange={(e) => setMax(Number(e.target.value))} className={select}><option value={0}>No limit</option><option value={3}>3 hashtags</option><option value={5}>5 hashtags</option><option value={10}>10 hashtags</option></select></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <button type="button" onClick={() => setText("#Bakery, #fresh bread #bakery #### small business tips")} className="font-semibold text-brand hover:underline">Try an example</button>
          {text ? <button type="button" onClick={() => setText("")} className="font-semibold text-ink-600 hover:underline">Clear</button> : null}
          <span className="text-ink-500">Your text stays in your browser.</span>
        </div>
      </div>

      <div aria-live="polite" className="space-y-3">
        {r.tags.length === 0 ? <p className="rounded-2xl border border-ink-100 bg-ink-50 p-5 text-sm text-ink-600">Your clean hashtags appear here.</p> : (
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-ink">{r.tags.length} hashtag{r.tags.length === 1 ? "" : "s"}</p><button type="button" onClick={copy} className="rounded-lg border border-ink-200 bg-white px-3 py-1 text-xs font-semibold text-ink hover:bg-ink-50">{copied ? "Copied" : "Copy"}</button></div>
            <p className="mt-2 break-words rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink">{r.text}</p>
            <ul className="mt-3 space-y-1 text-xs text-ink-600">
              {r.duplicates > 0 ? <li>Removed {r.duplicates} duplicate{r.duplicates === 1 ? "" : "s"}.</li> : null}
              {r.dropped > 0 ? <li>Skipped {r.dropped} empty or number-only tag{r.dropped === 1 ? "" : "s"}.</li> : null}
              {r.overLimit > 0 ? <li>Left out {r.overLimit} to stay within your limit.</li> : null}
              {r.tags.length > 5 ? <li>Tip: two or three relevant hashtags are usually plenty on Facebook.</li> : null}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
