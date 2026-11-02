"use client";

import { useEffect, useMemo, useState } from "react";
import { THEMES, WEEKDAYS, buildCalendar, toCsv } from "@/lib/tools/calendar";

const field = "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";
const label = "block text-sm font-medium text-ink-700";

function nextMonday(): string {
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const add = ((8 - today.getUTCDay()) % 7) || 7;
  return new Date(today.getTime() + add * 86_400_000).toISOString().slice(0, 10);
}

export function CalendarTool() {
  const [start, setStart] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [perWeek, setPerWeek] = useState(3);
  const [days, setDays] = useState<number[]>([0, 2, 4]);
  const [time, setTime] = useState("10:00");
  const [themes, setThemes] = useState<string[]>(THEMES.map((t) => t.name));

  // The date depends on the visitor's clock, so it is filled in after the page loads.
  useEffect(() => setStart(nextMonday()), []);

  const result = useMemo(() => (start ? buildCalendar({ start, weeks, perWeek, days, time, themes }) : null), [start, weeks, perWeek, days, time, themes]);

  const toggle = <T,>(list: T[], value: T, set: (v: T[]) => void) => set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const download = () => {
    if (!result?.ok) return;
    const blob = new Blob([toCsv(result.rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "facebook-content-calendar.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-card md:grid-cols-4">
        <label className={label}>Start date<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={field} /></label>
        <label className={label}>Weeks
          <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className={field}>{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </label>
        <label className={label}>Posts per week
          <select value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))} className={field}>{Array.from({ length: 7 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </label>
        <label className={label}>Time of day<input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} /></label>
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-medium text-ink-700">Days you can post</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAYS.map((d, i) => (
              <label key={d} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${days.includes(i) ? "border-brand bg-brand-50 font-semibold text-brand-700" : "border-ink-200 text-ink-700"}`}>
                <input type="checkbox" className="sr-only" checked={days.includes(i)} onChange={() => toggle(days, i, setDays)} />
                {d.slice(0, 3)}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-medium text-ink-700">Post themes to rotate</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <label key={t.name} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${themes.includes(t.name) ? "border-brand bg-brand-50 font-semibold text-brand-700" : "border-ink-200 text-ink-700"}`}>
                <input type="checkbox" className="sr-only" checked={themes.includes(t.name)} onChange={() => toggle(themes, t.name, setThemes)} />
                {t.name}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {result && !result.ok ? <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{result.error}</p> : null}
      {result?.ok ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold">{result.rows.length} posts planned</h2>
            <button type="button" onClick={download} className="h-10 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-ink-800">Download as CSV</button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Day</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Theme</th><th className="px-4 py-3">What to post</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {result.rows.map((r) => (
                  <tr key={`${r.date}-${r.theme}`}>
                    <td className="whitespace-nowrap px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3">{r.weekday}</td>
                    <td className="px-4 py-3">{r.time}</td>
                    <td className="px-4 py-3 font-medium text-ink">{r.theme}</td>
                    <td className="px-4 py-3 text-ink-600">{r.prompt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
