/** Display helpers for planned dates and times. Calendar dates are shown exactly as planned (no timezone shift). */

export function formatPlanDate(localDate: string): string {
  const date = new Date(`${localDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return localDate;
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export function formatPlanTime(localTime: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(localTime);
  if (!match) return localTime;
  const hours = Number(match[1]);
  const suffix = hours >= 12 ? "PM" : "AM";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${match[2]} ${suffix}`;
}
