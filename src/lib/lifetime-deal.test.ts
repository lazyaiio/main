import { describe, expect, it } from "vitest";
import { DEFAULT_DEAL, buildOffer, dealBlocker, daysLeftText, isDealOver, lifetimePlans, normalizeDeal, parseDealForm, type DealPlan, type LifetimeDeal } from "./lifetime-deal";

const now = new Date("2026-11-08T10:00:00Z");
const plan = (over: Partial<DealPlan>): DealPlan => ({ key: "pro", name: "Pro", price_monthly: 990, price_lifetime: 9900, lifetime_available: true, visible: true, ...over });
const on: LifetimeDeal = { ...DEFAULT_DEAL, enabled: true };

describe("normalizeDeal", () => {
  it("always returns a complete, safe object", () => {
    expect(normalizeDeal(null)).toEqual(DEFAULT_DEAL);
    expect(normalizeDeal({ enabled: "yes" }).enabled).toBe(false);
    expect(normalizeDeal({ enabled: true, badge: "<b>x</b>" }).badge).toBe(DEFAULT_DEAL.badge);
    expect(normalizeDeal({ headline: "বাংলা" }).headline).toBe(DEFAULT_DEAL.headline);
    expect(normalizeDeal({ endsOn: "2026-02-30" }).endsOn).toBeNull();
    expect(normalizeDeal({ badge: "x".repeat(99) }).badge).toHaveLength(24);
  });
});

describe("parseDealForm", () => {
  const form = { enabled: true, badge: "Launch offer", headline: "Pay once.", subtext: "No renewals.", endsOn: "" };
  it("accepts a good form", () => {
    expect(parseDealForm(form, now)).toEqual({ ok: true, deal: { enabled: true, badge: "Launch offer", headline: "Pay once.", subtext: "No renewals.", endsOn: null } });
  });
  it("needs a badge and a headline, within the limits", () => {
    expect(parseDealForm({ ...form, badge: "" }, now).ok).toBe(false);
    expect(parseDealForm({ ...form, headline: "  " }, now).ok).toBe(false);
    expect(parseDealForm({ ...form, badge: "x".repeat(25) }, now).ok).toBe(false);
    expect(parseDealForm({ ...form, headline: "x".repeat(81) }, now).ok).toBe(false);
    expect(parseDealForm({ ...form, subtext: "x".repeat(201) }, now).ok).toBe(false);
  });
  it("rejects Bengali text and markup", () => {
    expect(parseDealForm({ ...form, headline: "একবার দিন" }, now).ok).toBe(false);
    expect(parseDealForm({ ...form, subtext: "<script>" }, now).ok).toBe(false);
  });
  it("checks the end date", () => {
    expect(parseDealForm({ ...form, endsOn: "2026-11-08" }, now).ok).toBe(true);
    expect(parseDealForm({ ...form, endsOn: "2026-11-07" }, now).ok).toBe(false);
    expect(parseDealForm({ ...form, endsOn: "2026-13-01" }, now).ok).toBe(false);
    expect(parseDealForm({ ...form, endsOn: "soon" }, now).ok).toBe(false);
  });
});

describe("what the site shows", () => {
  it("lists only visible paid plans that really sell lifetime, cheapest first", () => {
    const out = lifetimePlans([
      plan({ key: "advanced", name: "Advanced", price_lifetime: 19900 }),
      plan({ key: "pro" }),
      plan({ key: "free", price_monthly: 0, price_lifetime: 1 }),
      plan({ key: "hidden", visible: false }),
      plan({ key: "off", lifetime_available: false }),
      plan({ key: "noprice", price_lifetime: null }),
    ]);
    expect(out.map((o) => o.key)).toEqual(["pro", "advanced"]);
  });
  it("shows nothing when the deal is off, over, in the wrong currency, or nothing is for sale", () => {
    const plans = [plan({})];
    expect(buildOffer(DEFAULT_DEAL, plans, "BDT", now)).toBeNull();
    expect(dealBlocker({ ...on, endsOn: "2026-11-01" }, plans, "BDT", now)).toMatch(/end date/);
    expect(dealBlocker(on, plans, "USD", now)).toMatch(/BDT/);
    expect(dealBlocker(on, [plan({ lifetime_available: false })], "BDT", now)).toMatch(/lifetime price/);
    expect(dealBlocker(on, plans, "BDT", now)).toBeNull();
  });
  it("builds the offer with the end date and days left", () => {
    const offer = buildOffer({ ...on, endsOn: "2026-11-15" }, [plan({})], "BDT", now);
    expect(offer?.endsOnText).toBe("November 15, 2026");
    expect(offer?.daysLeft).toBe(8);
    expect(offer?.offers).toEqual([{ key: "pro", name: "Pro", price: 9900 }]);
    expect(buildOffer(on, [plan({})], "BDT", now)?.endsOnText).toBeNull();
  });
  it("knows when a deal is over: at the end of the chosen day (UTC)", () => {
    expect(isDealOver({ ...on, endsOn: "2026-11-08" }, now)).toBe(false);
    expect(isDealOver({ ...on, endsOn: "2026-11-08" }, new Date("2026-11-09T00:00:00Z"))).toBe(true);
    expect(isDealOver(on, now)).toBe(false);
  });
  it("words the countdown", () => {
    expect(daysLeftText(null)).toBeNull();
    expect(daysLeftText(1)).toBe("Ends today");
    expect(daysLeftText(5)).toBe("5 days left");
  });
});
