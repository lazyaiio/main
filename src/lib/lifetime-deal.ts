import { checkoutOpen } from "@/lib/payments/billing";
import { daysUntil, formatEndDate } from "@/lib/plan-emails";
import type { Currency } from "@/lib/pricing";

/**
 * The "Lifetime deal" highlight (pure: no database, no network).
 * Everything an admin types here is shown to visitors, so it must be English (American) plain text.
 * The deal only highlights what the plans already sell: a plan needs its lifetime price and "Lifetime available" switch on.
 */

export type LifetimeDeal = { enabled: boolean; badge: string; headline: string; subtext: string; endsOn: string | null };

export const DEAL_LIMITS = { badge: 24, headline: 80, subtext: 200 } as const;

export const DEFAULT_DEAL: LifetimeDeal = {
  enabled: false,
  badge: "Lifetime deal",
  headline: "Pay once. Skip the renewals.",
  subtext: "One payment, no monthly or yearly bills.",
  endsOn: null,
};

const BENGALI = /[\u0980-\u09FF]/;
const MARKUP = /[<>]/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function oneLine(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function validDate(value: unknown): string | null {
  if (typeof value !== "string" || !DATE.test(value)) return null;
  const d = new Date(`${value}T23:59:59Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : null;
}

/** Reads whatever is stored and always returns a complete, safe object. */
export function normalizeDeal(value: unknown): LifetimeDeal {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const badge = oneLine(v.badge, DEAL_LIMITS.badge) || DEFAULT_DEAL.badge;
  const headline = oneLine(v.headline, DEAL_LIMITS.headline) || DEFAULT_DEAL.headline;
  const bad = (s: string) => BENGALI.test(s) || MARKUP.test(s);
  // Missing text gets the default; text an admin cleared on purpose stays empty.
  const subtext = typeof v.subtext === "string" ? oneLine(v.subtext, DEAL_LIMITS.subtext) : DEFAULT_DEAL.subtext;
  return {
    enabled: v.enabled === true,
    badge: bad(badge) ? DEFAULT_DEAL.badge : badge,
    headline: bad(headline) ? DEFAULT_DEAL.headline : headline,
    subtext: bad(subtext) ? DEFAULT_DEAL.subtext : subtext,
    endsOn: validDate(v.endsOn),
  };
}

export type DealForm = { enabled: boolean; badge: string; headline: string; subtext: string; endsOn: string };

/** Checks the admin form. The end date, if given, may be today or later. */
export function parseDealForm(form: DealForm, now: Date = new Date()): { ok: true; deal: LifetimeDeal } | { ok: false; message: string } {
  const badge = oneLine(form.badge, 200);
  const headline = oneLine(form.headline, 400);
  const subtext = oneLine(form.subtext, 600);
  if (!badge || !headline) return { ok: false, message: "Add a badge and a headline." };
  if (badge.length > DEAL_LIMITS.badge) return { ok: false, message: `The badge can have at most ${DEAL_LIMITS.badge} characters.` };
  if (headline.length > DEAL_LIMITS.headline) return { ok: false, message: `The headline can have at most ${DEAL_LIMITS.headline} characters.` };
  if (subtext.length > DEAL_LIMITS.subtext) return { ok: false, message: `The text under the headline can have at most ${DEAL_LIMITS.subtext} characters.` };
  for (const text of [badge, headline, subtext]) {
    if (BENGALI.test(text)) return { ok: false, message: "Site text must be in English. Remove the Bengali characters." };
    if (MARKUP.test(text)) return { ok: false, message: "Use plain text only (no < or > characters)." };
  }
  let endsOn: string | null = null;
  if (form.endsOn.trim() !== "") {
    endsOn = validDate(form.endsOn.trim());
    if (!endsOn) return { ok: false, message: "That end date is not valid." };
    if (new Date(`${endsOn}T23:59:59Z`).getTime() <= now.getTime()) return { ok: false, message: "The end date must be today or later." };
  }
  return { ok: true, deal: { enabled: form.enabled, badge, headline, subtext, endsOn } };
}

/** The moment sales stop: the end of the chosen day (UTC). */
export function dealEndsAt(deal: LifetimeDeal): Date | null {
  return deal.endsOn ? new Date(`${deal.endsOn}T23:59:59Z`) : null;
}

export function isDealOver(deal: LifetimeDeal, now: Date = new Date()): boolean {
  const end = dealEndsAt(deal);
  return end !== null && end.getTime() <= now.getTime();
}

export type DealPlan = { key: string; name: string; price_monthly: number | null; price_lifetime: number | null; lifetime_available: boolean; visible: boolean };
export type LifetimeOfferItem = { key: string; name: string; price: number };
export type LifetimeOffer = {
  badge: string;
  headline: string;
  subtext: string;
  currency: Currency;
  /** Cheapest first. Never empty. */
  offers: LifetimeOfferItem[];
  endsOnText: string | null;
  daysLeft: number | null;
};

/** Plans that really sell a lifetime option right now (visible, paid, price set, switch on). */
export function lifetimePlans(plans: DealPlan[]): LifetimeOfferItem[] {
  return plans
    .filter((p) => p.visible && p.key !== "free" && p.price_monthly !== 0 && p.lifetime_available && p.price_lifetime !== null && p.price_lifetime > 0)
    .map((p) => ({ key: p.key, name: p.name, price: Number(p.price_lifetime) }))
    .sort((a, b) => a.price - b.price);
}

/** Why the highlight is not showing, or null when it is showing. Used by the admin page and by the site. */
export function dealBlocker(deal: LifetimeDeal, plans: DealPlan[], currency: Currency, now: Date = new Date()): string | null {
  if (!deal.enabled) return "The deal is switched off.";
  if (isDealOver(deal, now)) return "The end date has passed.";
  if (!checkoutOpen(currency)) return `The site currency is ${currency}, but bKash checkout needs BDT.`;
  if (lifetimePlans(plans).length === 0) return "No visible paid plan has a lifetime price with \"Lifetime available\" switched on.";
  return null;
}

export function buildOffer(deal: LifetimeDeal, plans: DealPlan[], currency: Currency, now: Date = new Date()): LifetimeOffer | null {
  if (dealBlocker(deal, plans, currency, now)) return null;
  const end = dealEndsAt(deal);
  return {
    badge: deal.badge,
    headline: deal.headline,
    subtext: deal.subtext,
    currency,
    offers: lifetimePlans(plans),
    endsOnText: end ? formatEndDate(end.toISOString()) : null,
    daysLeft: end ? daysUntil(end.toISOString(), now) : null,
  };
}

/** "Ends today", "1 day left", "5 days left". */
export function daysLeftText(daysLeft: number | null): string | null {
  if (daysLeft === null) return null;
  if (daysLeft <= 1) return "Ends today";
  return `${daysLeft} days left`;
}
