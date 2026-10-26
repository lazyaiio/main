"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { localToUtc } from "@/lib/zone-time";

const INPUT = "h-11 rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

function show(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/**
 * Date and time input for scheduling. The value is ALWAYS read as the clock time in the workspace time
 * zone (set in Settings), not the time zone of the server or of this computer. The text under the
 * field shows the current time there, what the chosen time means on this computer, and warns when the
 * two time zones differ, so nobody has to guess.
 */
export function WhenField({
  id,
  name = "when",
  label = "Date and time",
  defaultValue,
  workspaceTimeZone,
  nowIso,
  compact = false,
}: {
  id: string;
  name?: string;
  label?: string;
  defaultValue: string;
  workspaceTimeZone: string;
  nowIso: string;
  compact?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [now, setNow] = useState(() => new Date(nowIso));
  const [browserZone, setBrowserZone] = useState<string | null>(null);

  useEffect(() => {
    setBrowserZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const moment = useMemo(() => {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value);
    if (!match?.[1] || !match[2]) return null;
    try {
      const date = localToUtc(match[1], match[2], workspaceTimeZone);
      return Number.isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }, [value, workspaceTimeZone]);

  const differs = browserZone !== null && browserZone !== workspaceTimeZone;
  const past = moment !== null && moment.getTime() < now.getTime() + 60_000;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-700">
        {label} <span className="font-normal text-ink-500">({workspaceTimeZone} time)</span>
      </label>
      <input
        id={id}
        name={name}
        type="datetime-local"
        required
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-describedby={`${id}-help`}
        className={INPUT}
      />
      <div id={`${id}-help`} className="space-y-1 text-xs text-ink-600" aria-live="polite">
        {moment ? (
          <p>
            <span className="font-semibold text-ink-700">Will be posted:</span> {show(moment, workspaceTimeZone)}
            {differs && browserZone ? <> · on this computer ({browserZone}): {show(moment, browserZone)}</> : null}
          </p>
        ) : null}
        {past ? (
          <p role="alert" className="font-medium text-red-700">
            That time has already passed. Choose a time at least a few minutes from now.
          </p>
        ) : null}
        {!compact ? (
          <p>
            Now in {workspaceTimeZone}: <span className="font-medium">{show(now, workspaceTimeZone)}</span>
          </p>
        ) : null}
        {differs && !compact ? (
          <p role="status" className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-900">
            This computer uses {browserZone}, but your workspace uses {workspaceTimeZone}. The time you type is read as {workspaceTimeZone} time.{" "}
            <Link href="/app/settings" className="font-semibold underline">
              Change the workspace time zone
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
