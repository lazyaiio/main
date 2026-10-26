/**
 * Time zone helpers shared by the campaign planner, scheduling, and the browser.
 * Pure (no server-only imports), so client components can use them too.
 *
 * A "local" date or time here means the wall-clock reading in a named time zone such as Asia/Dhaka.
 * The server always stores UTC moments and converts using the WORKSPACE time zone, never the time
 * zone of the server (which is UTC on Vercel) or of the person's computer.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

type ZoneParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

export function zoneParts(ms: number, timeZone: string): ZoneParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Milliseconds the timezone is ahead of UTC at the given instant. */
function offsetMs(ms: number, timeZone: string): number {
  const p = zoneParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Today's calendar date ("YYYY-MM-DD") in the given timezone. */
export function todayInZone(now: Date, timeZone: string): string {
  const p = zoneParts(now.getTime(), timeZone);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Converts a local date and time ("2026-11-02", "10:00") in a timezone to a UTC instant. */
export function localToUtc(date: string, time: string, timeZone: string): Date {
  const d = DATE_RE.exec(date);
  const t = TIME_RE.exec(time);
  if (!d || !t) throw new Error("Invalid date or time");
  const guess = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  // Two passes handle timezones whose offset changes (daylight saving) near the chosen time.
  let utc = guess - offsetMs(guess, timeZone);
  utc = guess - offsetMs(utc, timeZone);
  return new Date(utc);
}

