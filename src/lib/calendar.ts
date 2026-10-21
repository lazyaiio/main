export type GridDay = { iso: string; day: number; inMonth: boolean };

export function parseMonthParam(raw: unknown, fallback: string): string {
  return typeof raw === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : fallback;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

/** Weeks (Sunday first) covering the month, as plain calendar dates. */
export function buildMonthGrid(month: string): GridDay[][] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rows = Math.ceil((first.getUTCDay() + daysInMonth) / 7);

  const weeks: GridDay[][] = [];
  for (let r = 0; r < rows; r++) {
    const week: GridDay[] = [];
    for (let c = 0; c < 7; c++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + r * 7 + c);
      week.push({
        iso: d.toISOString().slice(0, 10),
        day: d.getUTCDate(),
        inMonth: d.getUTCMonth() === m - 1,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

/** The calendar date (YYYY-MM-DD) an instant falls on in a timezone. */
export function localDateKey(iso: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(typeof iso === "string" ? new Date(iso) : iso);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** UTC bounds that safely contain a whole month in any timezone (±1 day padding). */
export function monthQueryRange(month: string): { fromIso: string; toIso: string } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return {
    fromIso: new Date(Date.UTC(y, m - 1, 0)).toISOString(),
    toIso: new Date(Date.UTC(y, m, 2)).toISOString(),
  };
}
