/** Free tool: content calendar generator. Pure functions, dates in UTC so the result never depends on the visitor's time zone. */

export const THEMES = [
  { name: "Tip", prompt: "Share one practical tip your audience can use today." },
  { name: "Behind the scenes", prompt: "Show how you make, prepare, or deliver your work." },
  { name: "Customer story", prompt: "Tell a short story about a real customer (with permission)." },
  { name: "Offer", prompt: "Announce an offer, a new item, or an opening time, with one clear next step." },
  { name: "Question", prompt: "Ask your audience a simple question and reply to every comment." },
  { name: "Myth versus fact", prompt: "Correct a common misunderstanding in your field." },
  { name: "How-to", prompt: "Explain a small task in three to five numbered steps." },
] as const;

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type CalendarRow = { date: string; weekday: string; time: string; theme: string; prompt: string };

export type CalendarInput = { start: string; weeks: number; perWeek: number; days: number[]; time: string; themes: string[] };

const DAY_MS = 86_400_000;

export function parseDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

/** Returns the calendar, or an error message. Days are 0 = Monday … 6 = Sunday. */
export function buildCalendar(input: CalendarInput): { ok: true; rows: CalendarRow[] } | { ok: false; error: string } {
  const start = parseDate(input.start);
  if (!start) return { ok: false, error: "Choose a valid start date." };
  if (!Number.isInteger(input.weeks) || input.weeks < 1 || input.weeks > 12) return { ok: false, error: "Choose between 1 and 12 weeks." };
  if (!Number.isInteger(input.perWeek) || input.perWeek < 1 || input.perWeek > 7) return { ok: false, error: "Choose between 1 and 7 posts per week." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return { ok: false, error: "Choose a valid time." };
  const days = [...new Set(input.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  if (days.length === 0) return { ok: false, error: "Choose at least one weekday." };
  const chosen = THEMES.filter((t) => input.themes.includes(t.name));
  if (chosen.length === 0) return { ok: false, error: "Choose at least one theme." };

  const perWeekDays = days.slice(0, input.perWeek);
  const rows: CalendarRow[] = [];
  // Monday of the week that contains the start date.
  const mondayOffset = (start.getUTCDay() + 6) % 7;
  const monday = new Date(start.getTime() - mondayOffset * DAY_MS);
  let n = 0;
  for (let w = 0; w < input.weeks; w++) {
    for (const d of perWeekDays) {
      const date = new Date(monday.getTime() + (w * 7 + d) * DAY_MS);
      if (date < start) continue;
      const theme = chosen[n % chosen.length] as (typeof THEMES)[number];
      rows.push({ date: date.toISOString().slice(0, 10), weekday: WEEKDAYS[d] as string, time: input.time, theme: theme.name, prompt: theme.prompt });
      n++;
    }
  }
  return { ok: true, rows };
}

/** One CSV cell. Quotes are doubled, and cells that a spreadsheet could read as a formula get a leading apostrophe. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: CalendarRow[]): string {
  const header = ["Date", "Day", "Time", "Theme", "What to post", "Your post text"];
  return [header, ...rows.map((r) => [r.date, r.weekday, r.time, r.theme, r.prompt, ""])].map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
