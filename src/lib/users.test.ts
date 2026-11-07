import { describe, expect, it } from "vitest";
import { buildPlanChange, cleanReason, cleanSearch, describePlan, isUuid, parsePage } from "./users";

const now = new Date("2026-11-08T10:00:00Z");
const known = ["free", "pro", "advanced"];

describe("cleanSearch", () => {
  it("trims, flattens whitespace, removes control characters and caps the length", () => {
    expect(cleanSearch("  jane \n  doe\u0000 ")).toBe("jane doe");
    expect(cleanSearch("x".repeat(200))).toHaveLength(80);
  });
  it("ignores anything that is not a single string", () => {
    expect(cleanSearch(undefined)).toBe("");
    expect(cleanSearch(["a", "b"])).toBe("");
  });
});

describe("parsePage and isUuid", () => {
  it("falls back to page 1 for nonsense", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-4")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });
  it("recognizes only real ids", () => {
    expect(isUuid("00000000-0000-0000-0000-0000000000a9")).toBe(true);
    expect(isUuid("not-an-id")).toBe(false);
    expect(isUuid("00000000-0000-0000-0000-0000000000a9; drop")).toBe(false);
  });
});

describe("cleanReason", () => {
  it("keeps one line of at most 300 characters", () => {
    expect(cleanReason("  chargeback \n dispute ")).toBe("chargeback dispute");
    expect(cleanReason("y".repeat(500))).toHaveLength(300);
  });
});

describe("buildPlanChange", () => {
  it("rejects an unknown plan", () => {
    expect(buildPlanChange({ plan: "gold", knownPlans: known, period: "manual", endsOn: "" }, now).ok).toBe(false);
  });
  it("Free has no period and no end", () => {
    expect(buildPlanChange({ plan: "free", knownPlans: known, period: "yearly", endsOn: "2027-01-01" }, now)).toEqual({ ok: true, plan: "free", period: null, expiresAt: null });
  });
  it("manual and lifetime never end", () => {
    expect(buildPlanChange({ plan: "pro", knownPlans: known, period: "manual", endsOn: "" }, now)).toEqual({ ok: true, plan: "pro", period: null, expiresAt: null });
    expect(buildPlanChange({ plan: "pro", knownPlans: known, period: "lifetime", endsOn: "" }, now)).toEqual({ ok: true, plan: "pro", period: "lifetime", expiresAt: null });
  });
  it("monthly and yearly need a future date and end at the end of that day (UTC)", () => {
    expect(buildPlanChange({ plan: "pro", knownPlans: known, period: "monthly", endsOn: "2026-12-08" }, now)).toEqual({ ok: true, plan: "pro", period: "monthly", expiresAt: "2026-12-08T23:59:59.000Z" });
    expect(buildPlanChange({ plan: "pro", knownPlans: known, period: "yearly", endsOn: "" }, now).ok).toBe(false);
    expect(buildPlanChange({ plan: "pro", knownPlans: known, period: "yearly", endsOn: "2026-11-07" }, now).ok).toBe(false);
    expect(buildPlanChange({ plan: "pro", knownPlans: known, period: "yearly", endsOn: "2026-02-30" }, now).ok).toBe(false);
    expect(buildPlanChange({ plan: "pro", knownPlans: known, period: "yearly", endsOn: "2040-01-01" }, now).ok).toBe(false);
  });
  it("rejects an unknown way of holding the plan", () => {
    expect(buildPlanChange({ plan: "pro", knownPlans: known, period: "forever", endsOn: "" }, now).ok).toBe(false);
  });
});

describe("describePlan", () => {
  it("reads naturally", () => {
    expect(describePlan({ plan: "free", plan_period: null, plan_expires_at: null })).toBe("Free");
    expect(describePlan({ plan: "pro", plan_period: "lifetime", plan_expires_at: null })).toBe("pro (lifetime)");
    expect(describePlan({ plan: "pro", plan_period: "monthly", plan_expires_at: "2026-12-08T23:59:59Z" })).toBe("pro until 2026-12-08");
    expect(describePlan({ plan: "pro", plan_period: null, plan_expires_at: null })).toBe("pro (no end date)");
  });
});
