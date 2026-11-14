"use client";

import { useMemo, useState } from "react";
import { parseCount } from "@/lib/tools/engagement";
import { followerGrowth } from "@/lib/tools/growth";

const field = "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";
const FIELDS = [
  { key: "start", label: "Followers at the start", hint: "Your count at the beginning of the period" },
  { key: "end", label: "Followers now", hint: "Your count at the end of the period" },
  { key: "days", label: "Days between the two counts", hint: "For example 28" },
  { key: "projectDays", label: "Days to look ahead", hint: "Optional. A straight-line estimate" },
] as const;
type Key = (typeof FIELDS)[number]["key"];

export function GrowthTool() {
  const [v, setV] = useState<Record<Key, string>>({ start: "", end: "", days: "", projectDays: "" });
  const started = Object.values(v).some((x) => x.trim() !== "");
  const result = useMemo(() => followerGrowth({ start: parseCount(v.start), end: parseCount(v.end), days: parseCount(v.days), projectDays: parseCount(v.projectDays) }), [v]);
  const n = (x: number) => x.toLocaleString("en-US");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key}><label htmlFor={`gr-${f.key}`} className="text-sm font-medium text-ink-700">{f.label}</label><input id={`gr-${f.key}`} inputMode="numeric" autoComplete="off" value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} className={field} /><p className="mt-1 text-xs text-ink-500">{f.hint}</p></div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <button type="button" onClick={() => setV({ start: "1000", end: "1140", days: "28", projectDays: "90" })} className="font-semibold text-brand hover:underline">Try an example</button>
          {started ? <button type="button" onClick={() => setV({ start: "", end: "", days: "", projectDays: "" })} className="font-semibold text-ink-600 hover:underline">Clear</button> : null}
          <span className="text-ink-500">Nothing is sent anywhere.</span>
        </div>
      </div>
      <div aria-live="polite" className="space-y-3">
        {!started ? <p className="rounded-2xl border border-ink-100 bg-ink-50 p-5 text-sm text-ink-600">Enter two follower counts and the days between them.</p> : null}
        {started && !result.ok ? <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{result.error}</p> : null}
        {started && result.ok ? (
          <>
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
              <p className="text-sm text-ink-600">{result.direction === "down" ? "Net change (you lost followers)" : "Net change"}</p>
              <p className="font-display text-4xl font-extrabold text-ink">{result.net > 0 ? "+" : ""}{n(result.net)}</p>
              <p className="mt-1 text-sm text-ink-600">{result.percent === null ? "No percentage, because you started at zero." : `${result.percent > 0 ? "+" : ""}${result.percent}% over the period`}</p>
            </div>
            <dl className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-ink-50 px-3 py-2"><dt className="text-xs text-ink-500">Per day</dt><dd className="font-display text-lg font-bold">{result.perDay}</dd></div>
              <div className="rounded-xl bg-ink-50 px-3 py-2"><dt className="text-xs text-ink-500">Per week</dt><dd className="font-display text-lg font-bold">{result.perWeek}</dd></div>
            </dl>
            {result.projectDays > 0 ? <p className="rounded-2xl border border-ink-100 bg-white p-4 text-sm text-ink-700">If you keep the same pace for {n(result.projectDays)} more days, you would have about <strong>{n(result.projected)}</strong> followers. This is simple arithmetic, not a forecast. Real growth is uneven.</p> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
