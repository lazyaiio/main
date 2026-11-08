"use client";

import { useMemo, useState } from "react";
import { buildUtmUrl } from "@/lib/tools/utm";

const input = "mt-1 block w-full rounded-xl border border-ink-200 px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export function UtmTool() {
  const [f, setF] = useState({ url: "", source: "facebook", medium: "social", campaign: "", term: "", content: "" });
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => buildUtmUrl(f), [f]);
  const started = f.url.trim() !== "" || f.campaign.trim() !== "";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function copy() {
    if (!result.ok) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The link is selectable, so it can still be copied by hand.
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label htmlFor="utm-url" className="text-sm font-medium text-ink-700">Web address to link to</label><input id="utm-url" value={f.url} onChange={set("url")} placeholder="https://example.com/spring-sale" className={input} /></div>
          <div><label htmlFor="utm-source" className="text-sm font-medium text-ink-700">Source (required)</label><input id="utm-source" value={f.source} onChange={set("source")} className={input} /><p className="mt-1 text-xs text-ink-500">Where the click comes from, such as facebook.</p></div>
          <div><label htmlFor="utm-medium" className="text-sm font-medium text-ink-700">Medium (required)</label><input id="utm-medium" value={f.medium} onChange={set("medium")} className={input} /><p className="mt-1 text-xs text-ink-500">The kind of link, such as social or email.</p></div>
          <div className="sm:col-span-2"><label htmlFor="utm-campaign" className="text-sm font-medium text-ink-700">Campaign name (required)</label><input id="utm-campaign" value={f.campaign} onChange={set("campaign")} placeholder="spring-sale" className={input} /></div>
          <div><label htmlFor="utm-term" className="text-sm font-medium text-ink-700">Term (optional)</label><input id="utm-term" value={f.term} onChange={set("term")} className={input} /></div>
          <div><label htmlFor="utm-content" className="text-sm font-medium text-ink-700">Content (optional)</label><input id="utm-content" value={f.content} onChange={set("content")} placeholder="post-1" className={input} /><p className="mt-1 text-xs text-ink-500">Tells two links in one campaign apart.</p></div>
        </div>
        <p className="mt-3 text-sm text-ink-500">Your text stays in your browser. It is never sent anywhere.</p>
      </div>

      <div aria-live="polite" className="space-y-3">
        {!started ? <p className="rounded-2xl border border-ink-100 bg-ink-50 p-5 text-sm text-ink-600">Fill in the address and a campaign name. Your tagged link appears here.</p> : null}
        {started && !result.ok ? <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{result.error}</p> : null}
        {started && result.ok ? (
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-ink">Your link</p><button type="button" onClick={copy} className="rounded-lg border border-ink-200 bg-white px-3 py-1 text-xs font-semibold text-ink hover:bg-ink-50">{copied ? "Copied" : "Copy"}</button></div>
            <p className="mt-2 break-all rounded-xl bg-ink-50 px-3 py-2 font-mono text-sm text-ink">{result.url}</p>
            <p className="mt-2 text-xs text-ink-500">Added: {result.added.join(", ")}. Values are lowercased, and spaces become hyphens, so the same campaign always matches in your reports.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
