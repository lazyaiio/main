"use client";

import { useMemo, useState } from "react";
import { engagementRates, parseCount } from "@/lib/tools/engagement";

const FIELDS = [
  { key: "followers", label: "Followers", hint: "People who follow your Page" },
  { key: "posts", label: "Number of posts", hint: "How many posts the numbers below cover" },
  { key: "reactions", label: "Reactions (all posts)", hint: "Likes and other reactions, added up" },
  { key: "comments", label: "Comments (all posts)", hint: "" },
  { key: "shares", label: "Shares (all posts)", hint: "" },
  { key: "clicks", label: "Link clicks (all posts)", hint: "Optional" },
  { key: "totalReach", label: "Total reach (all posts)", hint: "Optional. Adds a second rate" },
] as const;

type Key = (typeof FIELDS)[number]["key"];

export function EngagementTool() {
  const [v, setV] = useState<Record<Key, string>>({ followers: "", posts: "", reactions: "", comments: "", shares: "", clicks: "", totalReach: "" });
  const result = useMemo(() => {
    const n = Object.fromEntries(FIELDS.map((f) => [f.key, parseCount(v[f.key])])) as Record<Key, number>;
    return engagementRates(n);
  }, [v]);
  const started = Object.values(v).some((x) => x.trim() !== "");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`eng-${f.key}`} className="text-sm font-medium text-ink-700">{f.label}</label>
              <input id={`eng-${f.key}`} inputMode="numeric" autoComplete="off" value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} className="mt-1 block w-full rounded-xl border border-ink-200 px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30" />
              {f.hint ? <p className="mt-1 text-xs text-ink-500">{f.hint}</p> : null}
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <button type="button" onClick={() => setV({ followers: "1200", posts: "8", reactions: "320", comments: "64", shares: "28", clicks: "40", totalReach: "9000" })} className="font-semibold text-brand hover:underline">Try an example</button>
          {started ? <button type="button" onClick={() => setV({ followers: "", posts: "", reactions: "", comments: "", shares: "", clicks: "", totalReach: "" })} className="font-semibold text-ink-600 hover:underline">Clear</button> : null}
          <span className="text-ink-500">Nothing is sent anywhere.</span>
        </div>
      </div>

      <div aria-live="polite" className="space-y-3">
        {!started ? <p className="rounded-2xl border border-ink-100 bg-ink-50 p-5 text-sm text-ink-600">Enter your numbers to see your engagement rate. You can find them in your Page Insights.</p> : null}
        {started && !result.ok ? <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{result.error}</p> : null}
        {result.ok && started ? (
          <>
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
              <p className="text-sm text-ink-600">Engagement rate by followers</p>
              <p className="font-display text-4xl font-extrabold text-ink">{result.rateByFollowers}%</p>
              <p className="mt-1 text-xs text-ink-500">Average engagements per post divided by followers.</p>
            </div>
            {result.rateByReach !== null ? (
              <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
                <p className="text-sm text-ink-600">Engagement rate by reach</p>
                <p className="font-display text-4xl font-extrabold text-ink">{result.rateByReach}%</p>
                <p className="mt-1 text-xs text-ink-500">All engagements divided by total reach.</p>
              </div>
            ) : null}
            <dl className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-ink-50 px-3 py-2"><dt className="text-xs text-ink-500">Total engagements</dt><dd className="font-display text-lg font-bold">{result.engagements.toLocaleString("en-US")}</dd></div>
              <div className="rounded-xl bg-ink-50 px-3 py-2"><dt className="text-xs text-ink-500">Per post</dt><dd className="font-display text-lg font-bold">{result.perPost.toLocaleString("en-US")}</dd></div>
            </dl>
          </>
        ) : null}
      </div>
    </div>
  );
}
