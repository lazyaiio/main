/** Engagement rate calculator (pure). */

export type EngagementInput = { followers: number; posts: number; reactions: number; comments: number; shares: number; clicks: number; totalReach: number };
export type EngagementResult =
  | { ok: false; error: string }
  | { ok: true; engagements: number; perPost: number; rateByFollowers: number; rateByReach: number | null };

const round2 = (n: number) => Math.round(n * 100) / 100;
const valid = (n: number) => Number.isFinite(n) && n >= 0;

/** Rate by followers = average engagements per post / followers x 100. Rate by reach = engagements / total reach x 100 (only when reach is given). */
export function engagementRates(i: EngagementInput): EngagementResult {
  for (const [name, v] of Object.entries(i)) if (!valid(v)) return { ok: false, error: `Check the ${name === "totalReach" ? "reach" : name} number: it must be zero or more.` };
  if (i.followers <= 0) return { ok: false, error: "Enter how many followers your Page has." };
  if (i.posts < 1) return { ok: false, error: "Enter how many posts the numbers cover (at least 1)." };
  const engagements = i.reactions + i.comments + i.shares + i.clicks;
  const perPost = engagements / i.posts;
  return {
    ok: true,
    engagements,
    perPost: round2(perPost),
    rateByFollowers: round2((perPost / i.followers) * 100),
    rateByReach: i.totalReach > 0 ? round2((engagements / i.totalReach) * 100) : null,
  };
}

/** Reads a number a person typed ("1,200", " 45 "). Empty means 0. Anything else is NaN. */
export function parseCount(text: string): number {
  const t = text.replace(/[,\s]/g, "");
  if (t === "") return 0;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}
