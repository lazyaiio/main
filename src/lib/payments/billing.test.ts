import { describe, expect, it } from "vitest";
import { checkoutOpen, daysLeft, isPeriod, priceFor } from "./billing";

const plan = { key: "pro", priceMonthly: 500, priceYearly: 5000, priceLifetime: 15000, lifetimeAvailable: true };

describe("priceFor", () => {
  it("returns the price of each period", () => {
    expect(priceFor(plan, "monthly")).toBe(500);
    expect(priceFor(plan, "yearly")).toBe(5000);
    expect(priceFor(plan, "lifetime")).toBe(15000);
  });
  it("hides the lifetime offer when it is switched off", () => {
    expect(priceFor({ ...plan, lifetimeAvailable: false }, "lifetime")).toBeNull();
  });
  it("cannot buy a free or unpriced period", () => {
    expect(priceFor({ ...plan, priceMonthly: 0 }, "monthly")).toBeNull();
    expect(priceFor({ ...plan, priceYearly: null }, "yearly")).toBeNull();
  });
});

describe("helpers", () => {
  it("accepts only known periods", () => {
    expect(isPeriod("monthly")).toBe(true);
    expect(isPeriod("weekly")).toBe(false);
    expect(isPeriod(undefined)).toBe(false);
  });
  it("opens checkout only in taka", () => {
    expect(checkoutOpen("BDT")).toBe(true);
    expect(checkoutOpen("USD")).toBe(false);
  });
  it("counts the days left, rounded up", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    expect(daysLeft("2026-11-04T06:00:00Z", now)).toBe(4);
    expect(daysLeft("2026-10-01T00:00:00Z", now)).toBe(0);
    expect(daysLeft(null, now)).toBeNull();
  });
});
