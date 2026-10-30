import { LIMIT_KEYS, type LimitKey } from "./plans";

/** What the public pricing page shows for one plan. Pure helpers, so they are easy to test. */
export type PublicPlan = {
  key: string;
  name: string;
  tagline: string;
  priceMonthly: number | null;
  priceYearly: number | null;
  features: string[];
  highlighted: boolean;
};

export const CURRENCIES = ["BDT", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "BDT";

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

/** "BDT 1,500" or "USD 9.99". Whole numbers show no decimals. Letters only, so the site stays English. */
export function formatPrice(amount: number, currency: Currency): string {
  const text = Number.isInteger(amount)
    ? amount.toLocaleString("en-US")
    : amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${text}`;
}

/** Percent saved by paying yearly instead of twelve months, or null when it is not a saving. */
export function yearlySavingsPercent(monthly: number | null, yearly: number | null): number | null {
  if (!monthly || !yearly || monthly <= 0) return null;
  const pct = Math.round((1 - yearly / (monthly * 12)) * 100);
  return pct > 0 ? pct : null;
}

/** One feature per line; blank lines dropped; at most 20 lines of 100 characters. */
export function parseFeatureLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean)
    .slice(0, 20)
    .map((line) => line.slice(0, 100));
}

/** Text from the admin form field, "" means no limit. Returns null (no limit) or a whole number, or undefined when invalid. */
export function parseLimitField(raw: string): number | null | undefined {
  const text = raw.trim();
  if (text === "") return null;
  if (!/^\d{1,13}$/.test(text)) return undefined;
  return Number(text);
}

/** Price field: "" means not set yet. Returns null, a number with at most 2 decimals, or undefined when invalid. */
export function parsePriceField(raw: string): number | null | undefined {
  const text = raw.trim().replace(/,/g, "");
  if (text === "") return null;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(text)) return undefined;
  return Number(text);
}

/** The few limits worth listing on a plan card, in a readable form. */
export function limitHighlights(limits: Partial<Record<LimitKey, number | null>>): string[] {
  const rows: string[] = [];
  const ai = limits.ai_generations_month;
  rows.push(ai === null ? "Unlimited AI posts" : typeof ai === "number" ? `${ai.toLocaleString("en-US")} AI posts per month` : "");
  const pages = limits.social_pages;
  rows.push(pages === null ? "Unlimited Facebook Pages" : typeof pages === "number" ? `${pages.toLocaleString("en-US")} Facebook ${pages === 1 ? "Page" : "Pages"}` : "");
  return rows.filter(Boolean);
}

export const EDITABLE_LIMIT_KEYS = LIMIT_KEYS;
