import type { Currency } from "@/lib/pricing";

export const PERIODS = ["monthly", "yearly", "lifetime"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = { monthly: "Monthly", yearly: "Yearly", lifetime: "Lifetime" };

export function isPeriod(value: unknown): value is Period {
  return typeof value === "string" && (PERIODS as readonly string[]).includes(value);
}

export type PricedPlan = {
  key: string;
  priceMonthly: number | null;
  priceYearly: number | null;
  priceLifetime: number | null;
  lifetimeAvailable: boolean;
};

/** The amount to charge, or null when this plan cannot be bought for that period (no price, free, or lifetime hidden). */
export function priceFor(plan: PricedPlan, period: Period): number | null {
  const value = period === "monthly" ? plan.priceMonthly : period === "yearly" ? plan.priceYearly : plan.lifetimeAvailable ? plan.priceLifetime : null;
  return value !== null && value > 0 ? value : null;
}

/** bKash only takes Bangladeshi taka, so checkout is only open when the site currency is BDT. */
export function checkoutOpen(currency: Currency): boolean {
  return currency === "BDT";
}

/** Days left until the plan ends, rounded up; null when it does not expire. */
export function daysLeft(expiresAt: string | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 86_400_000)) : null;
}
