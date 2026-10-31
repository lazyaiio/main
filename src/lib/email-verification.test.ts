import { describe, expect, it } from "vitest";
import { MAX_SENDS_PER_WINDOW, generateToken, hashToken, isTokenShape, planSend, tokenExpired } from "./email-verification";

const T0 = new Date("2026-11-01T10:00:00Z");
const fresh = { lastSentAt: null, sendsInWindow: 0, windowStartedAt: null };

describe("tokens", () => {
  it("makes long random tokens in the expected shape", () => {
    const a = generateToken();
    expect(isTokenShape(a)).toBe(true);
    expect(generateToken()).not.toBe(a);
  });
  it("hashes to 64 hex characters and never equals the token", () => {
    const token = generateToken();
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toBe(hashToken(token));
  });
  it("refuses tokens of the wrong shape", () => {
    expect(isTokenShape("short")).toBe(false);
    expect(isTokenShape(undefined)).toBe(false);
    expect(isTokenShape("x".repeat(43) + "!")).toBe(false);
  });
  it("knows when a token ran out", () => {
    expect(tokenExpired("2026-11-01T09:00:00Z", T0)).toBe(true);
    expect(tokenExpired("2026-11-01T11:00:00Z", T0)).toBe(false);
    expect(tokenExpired(null, T0)).toBe(true);
  });
});

describe("planSend", () => {
  it("allows the first email", () => {
    const plan = planSend(fresh, T0);
    expect(plan.allowed).toBe(true);
    if (plan.allowed) expect(plan.next.sendsInWindow).toBe(1);
  });
  it("makes people wait a minute between emails", () => {
    const plan = planSend({ lastSentAt: new Date(T0.getTime() - 20_000).toISOString(), sendsInWindow: 1, windowStartedAt: T0.toISOString() }, T0);
    expect(plan).toEqual({ allowed: false, reason: "too_soon" });
  });
  it("limits the number of emails per hour, then starts over", () => {
    const busy = { lastSentAt: new Date(T0.getTime() - 120_000).toISOString(), sendsInWindow: MAX_SENDS_PER_WINDOW, windowStartedAt: new Date(T0.getTime() - 600_000).toISOString() };
    expect(planSend(busy, T0)).toEqual({ allowed: false, reason: "too_many" });
    const later = new Date(T0.getTime() + 3_600_000);
    expect(planSend(busy, later).allowed).toBe(true);
  });
});
