/** Time zone converter for posting times (pure; uses the built-in Intl time zone data). */

export type ZoneChoice = { id: string; label: string };

/** A short list for the picker. Any other zone name from the browser's own list can be typed too. */
export const COMMON_ZONES: ZoneChoice[] = [
  { id: "Asia/Dhaka", label: "Dhaka" },
  { id: "Asia/Kolkata", label: "India (Kolkata)" },
  { id: "Asia/Dubai", label: "Dubai" },
  { id: "Asia/Singapore", label: "Singapore" },
  { id: "Europe/London", label: "London" },
  { id: "Europe/Paris", label: "Paris and Berlin" },
  { id: "America/New_York", label: "New York" },
  { id: "America/Chicago", label: "Chicago" },
  { id: "America/Los_Angeles", label: "Los Angeles" },
  { id: "Australia/Sydney", label: "Sydney" },
];

export function isValidZone(id: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: id });
    return /^[A-Za-z_]+(\/[A-Za-z_+\-0-9]+)*$/.test(id) || id === "UTC";
  } catch {
    return false;
  }
}

/** How many minutes the zone is ahead of UTC at the given instant. */
export function offsetMinutes(zone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

export type Instant = { ok: true; utc: Date; note: "ok" | "skipped" | "repeated" } | { ok: false; error: string };

/**
 * Turns a wall-clock time in a zone ("2026-11-09", "18:30", "Asia/Dhaka") into the exact moment it means.
 * Around a clock change, a time that does not exist is moved forward (note "skipped") and a time that happens twice
 * uses its first occurrence (note "repeated").
 */
export function zonedInstant(date: string, time: string, zone: string): Instant {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Choose a date." };
  if (!/^\d{2}:\d{2}$/.test(time)) return { ok: false, error: "Choose a time." };
  if (!isValidZone(zone)) return { ok: false, error: "That time zone is not recognized." };
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const check = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(check.getTime()) || check.getUTCMonth() !== m - 1 || hh > 23 || mm > 59) return { ok: false, error: "That date or time does not exist." };
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  // Candidate instants using the offsets in force a day before and a day after; keep those that map back to the same wall time.
  const offsets = new Set([offsetMinutes(zone, new Date(wall - 86_400_000)), offsetMinutes(zone, new Date(wall + 86_400_000))]);
  const matches = Array.from(offsets)
    .map((o) => new Date(wall - o * 60000))
    .filter((c) => offsetMinutes(zone, c) * 60000 === wall - c.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  if (matches.length === 0) {
    const before = offsetMinutes(zone, new Date(wall - 86_400_000));
    return { ok: true, utc: new Date(wall - before * 60000), note: "skipped" };
  }
  return { ok: true, utc: matches[0]!, note: matches.length > 1 ? "repeated" : "ok" };
}

export type ZoneRow = { zone: string; label: string; time: string; date: string; dayShift: -1 | 0 | 1; offset: string };

const fmtOffset = (min: number) => `UTC${min < 0 ? "-" : "+"}${String(Math.floor(Math.abs(min) / 60)).padStart(2, "0")}:${String(Math.abs(min) % 60).padStart(2, "0")}`;

/** The same moment as seen in each chosen zone, with a day marker when the date differs from the starting zone. */
export function convertToZones(utc: Date, fromZone: string, targets: ZoneChoice[]): ZoneRow[] {
  const dayKey = (zone: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(utc);
  const baseDay = Date.parse(`${dayKey(fromZone)}T00:00:00Z`);
  return targets
    .filter((t) => isValidZone(t.id))
    .map((t) => {
      const day = dayKey(t.id);
      const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - baseDay) / 86_400_000);
      return {
        zone: t.id,
        label: t.label,
        time: new Intl.DateTimeFormat("en-US", { timeZone: t.id, hour: "numeric", minute: "2-digit", hourCycle: "h12" }).format(utc),
        date: new Intl.DateTimeFormat("en-US", { timeZone: t.id, weekday: "short", month: "short", day: "numeric" }).format(utc),
        dayShift: (diff < 0 ? -1 : diff > 0 ? 1 : 0) as -1 | 0 | 1,
        offset: fmtOffset(offsetMinutes(t.id, utc)),
      };
    });
}
