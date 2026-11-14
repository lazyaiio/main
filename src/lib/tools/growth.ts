/** Follower growth calculator (pure). Simple arithmetic on the numbers a person types; it does not predict anything. */

export type GrowthInput = { start: number; end: number; days: number; projectDays: number };
export type GrowthResult =
  | { ok: false; error: string }
  | { ok: true; net: number; percent: number | null; perDay: number; perWeek: number; projected: number; projectDays: number; direction: "up" | "down" | "flat" };

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function followerGrowth(i: GrowthInput): GrowthResult {
  for (const [name, v] of Object.entries(i)) if (!Number.isFinite(v) || v < 0) return { ok: false, error: `Check the ${name === "projectDays" ? "projection length" : name} number: it must be zero or more.` };
  if (i.days < 1) return { ok: false, error: "Enter how many days the two counts are apart (at least 1)." };
  if (i.days > 3650) return { ok: false, error: "Use a period of 3,650 days (ten years) or less." };
  if (i.projectDays > 3650) return { ok: false, error: "Project at most 3,650 days ahead." };
  const net = i.end - i.start;
  const perDay = net / i.days;
  return {
    ok: true,
    net,
    percent: i.start > 0 ? round2((net / i.start) * 100) : null,
    perDay: round2(perDay),
    perWeek: round1(perDay * 7),
    // Straight-line: the same number of followers per day continues. A Page that gains or loses followers unevenly will differ.
    projected: Math.max(0, Math.round(i.end + perDay * i.projectDays)),
    projectDays: i.projectDays,
    direction: net > 0 ? "up" : net < 0 ? "down" : "flat",
  };
}
