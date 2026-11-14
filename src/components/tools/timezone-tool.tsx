"use client";

import { useMemo, useState } from "react";
import { COMMON_ZONES, convertToZones, isValidZone, zonedInstant, type ZoneChoice } from "@/lib/tools/timezones";

const field = "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export function TimezoneTool() {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [from, setFrom] = useState("Asia/Dhaka");
  const [picked, setPicked] = useState<string[]>(["Asia/Dhaka", "Europe/London", "America/New_York", "America/Los_Angeles"]);
  const [custom, setCustom] = useState("");

  const targets = useMemo<ZoneChoice[]>(() => {
    const list = COMMON_ZONES.filter((z) => picked.includes(z.id));
    const c = custom.trim();
    if (c && isValidZone(c) && !list.some((z) => z.id === c)) list.push({ id: c, label: c.replace(/_/g, " ") });
    return list;
  }, [picked, custom]);
  const instant = useMemo(() => (date ? zonedInstant(date, time, from) : null), [date, time, from]);
  const rows = useMemo(() => (instant && instant.ok ? convertToZones(instant.utc, from, [...targets]) : []), [instant, from, targets]);
  const customBad = custom.trim() !== "" && !isValidZone(custom.trim());

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="tz-date" className="text-sm font-medium text-ink-700">Date</label><input id="tz-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></div>
          <div><label htmlFor="tz-time" className="text-sm font-medium text-ink-700">Time</label><input id="tz-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} /></div>
          <div className="sm:col-span-2"><label htmlFor="tz-from" className="text-sm font-medium text-ink-700">That time is in</label><select id="tz-from" value={from} onChange={(e) => setFrom(e.target.value)} className={field}>{COMMON_ZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}</select></div>
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-ink-700">Show it in</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {COMMON_ZONES.map((z) => (
              <label key={z.id} className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={picked.includes(z.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, z.id] : picked.filter((p) => p !== z.id))} className="h-4 w-4 rounded border-ink-300" />{z.label}</label>
            ))}
          </div>
          <label htmlFor="tz-custom" className="mt-3 block text-sm font-medium text-ink-700">Another zone (optional)</label>
          <input id="tz-custom" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Africa/Lagos" className={field} />
          {customBad ? <p className="mt-1 text-xs text-amber-800">That name is not recognized. Use the form Region/City, such as Africa/Lagos.</p> : null}
        </fieldset>
        <button type="button" onClick={() => setDate(new Date().toISOString().slice(0, 10))} className="mt-3 text-sm font-semibold text-brand hover:underline">Use today&apos;s date</button>
        <p className="mt-3 text-xs text-ink-500">The math runs in your browser. Nothing is sent anywhere.</p>
      </div>

      <div aria-live="polite" className="space-y-3">
        {!instant ? <p className="rounded-2xl border border-ink-100 bg-ink-50 p-5 text-sm text-ink-600">Choose a date and a time to see it in other time zones.</p> : null}
        {instant && !instant.ok ? <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{instant.error}</p> : null}
        {instant && instant.ok && instant.note === "skipped" ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Clocks skip that time on that date, so it was moved forward to the next valid time.</p> : null}
        {instant && instant.ok && instant.note === "repeated" ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Clocks show that time twice on that date. The first one was used.</p> : null}
        {rows.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">The same moment in each chosen time zone</caption>
              <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500"><tr><th scope="col" className="px-4 py-2">Place</th><th scope="col" className="px-4 py-2">Time</th><th scope="col" className="px-4 py-2">Date</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => (
                  <tr key={r.zone}>
                    <td className="px-4 py-2.5"><span className="font-semibold text-ink">{r.label}</span><span className="block text-xs text-ink-500">{r.offset}</span></td>
                    <td className="px-4 py-2.5 font-display text-lg font-bold text-ink">{r.time}</td>
                    <td className="px-4 py-2.5 text-ink-700">{r.date}{r.dayShift !== 0 ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{r.dayShift > 0 ? "next day" : "previous day"}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
