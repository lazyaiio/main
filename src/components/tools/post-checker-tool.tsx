"use client";

import { useMemo, useState } from "react";
import { analyze, suggestions } from "@/lib/tools/post-checker";

const SAMPLE = "Fresh sourdough is ready.\n\nWe baked it at dawn, and the first loaves are already on the shelf. Come by before noon and tell us your favorite.\n\n#bakery #freshbread";

export function PostCheckerTool() {
  const [text, setText] = useState("");
  const m = useMemo(() => analyze(text), [text]);
  const tips = useMemo(() => suggestions(m), [m]);

  const stat = (name: string, value: string | number) => (
    <div className="rounded-xl bg-ink-50 px-3 py-2">
      <dt className="text-xs text-ink-500">{name}</dt>
      <dd className="font-display text-lg font-bold text-ink">{value}</dd>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <label htmlFor="post-text" className="text-sm font-medium text-ink-700">Paste or write your post</label>
        <textarea id="post-text" value={text} onChange={(e) => setText(e.target.value)} rows={14} maxLength={20000} className="mt-2 block w-full rounded-xl border border-ink-200 px-3 py-2.5 text-sm leading-6 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30" placeholder="Write the post you plan to publish…" />
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <button type="button" onClick={() => setText(SAMPLE)} className="font-semibold text-brand hover:underline">Try an example</button>
          {text ? <button type="button" onClick={() => setText("")} className="font-semibold text-ink-600 hover:underline">Clear</button> : null}
          <span className="text-ink-500">Your text stays in your browser. It is never sent anywhere.</span>
        </div>
      </div>

      <div className="space-y-4" aria-live="polite">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stat("Characters", m.characters.toLocaleString("en-US"))}
          {stat("Words", m.words.toLocaleString("en-US"))}
          {stat("Sentences", m.sentences)}
          {stat("Words per sentence", m.avgWordsPerSentence)}
          {stat("Hashtags", m.hashtags)}
          {stat("Links", m.links)}
        </dl>
        {m.words > 0 ? <p className="text-sm text-ink-700">Reading ease: <strong>{m.readingEase}</strong> out of 100 ({m.readingLabel.toLowerCase()}).</p> : null}
        {tips.length > 0 ? (
          <ul className="space-y-2">
            {tips.map((t, i) => (
              <li key={i} className="flex gap-2 rounded-xl border border-ink-100 bg-white p-3 text-sm shadow-card">
                <span aria-hidden="true" className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${t.level === "good" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{t.level === "good" ? "✓" : "!"}</span>
                <span><span className="sr-only">{t.level === "good" ? "Good: " : "Check: "}</span>{t.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-ink-50 p-4 text-sm text-ink-600">Write or paste a post to see how it reads.</p>
        )}
      </div>
    </div>
  );
}
