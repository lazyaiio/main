import { describe, expect, it } from "vitest";
import { LIMIT_KEYS, buildUsageRows, formatAmount, isAtLimit, monthStartUtc, parseNumberMap, percentUsed, type Limits, type Usage } from "./plans";

describe("monthStartUtc", () => {
  it("is the first moment of the month in UTC", () => {
    expect(monthStartUtc(new Date("2026-10-26T13:45:00Z"))).toBe("2026-10-01T00:00:00.000Z");
    expect(monthStartUtc(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12-01T00:00:00.000Z");
    expect(monthStartUtc(new Date("2027-01-01T00:00:00Z"))).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("percentUsed and isAtLimit", () => {
  it("calculates and caps", () => {
    expect(percentUsed(25, 100)).toBe(25);
    expect(percentUsed(150, 100)).toBe(100);
    expect(percentUsed(0, 100)).toBe(0);
    expect(percentUsed(1, 3)).toBe(33);
  });
  it("handles no limit and a zero limit", () => {
    expect(percentUsed(10, null)).toBeNull();
    expect(percentUsed(0, 0)).toBe(100);
    expect(isAtLimit(100, 100)).toBe(true);
    expect(isAtLimit(99, 100)).toBe(false);
    expect(isAtLimit(1000, null)).toBe(false);
    expect(isAtLimit(0, 0)).toBe(true);
  });
});

describe("formatAmount", () => {
  it("formats counts and sizes", () => {
    expect(formatAmount("content_items", 1234)).toBe("1,234");
    expect(formatAmount("media_bytes", 512 * 1024)).toBe("512 KB");
    expect(formatAmount("media_bytes", 3 * 1024 * 1024)).toBe("3.0 MB");
    expect(formatAmount("media_bytes", 200 * 1024 * 1024)).toBe("200 MB");
    expect(formatAmount("media_bytes", 2 * 1024 * 1024 * 1024)).toBe("2.0 GB");
  });
});

describe("buildUsageRows", () => {
  const limits = { ai_generations_month: 100, content_items: 500, social_pages: 3, media_files: 100, media_bytes: 209715200, campaigns_open: null } as Limits;
  const usage = { ai_generations_month: 85, content_items: 10, social_pages: 3, media_files: 0, media_bytes: 1048576, campaigns_open: 4 } as Usage;
  const rows = buildUsageRows(limits, usage);

  it("returns one row per limit, in order", () => {
    expect(rows.map((r) => r.key)).toEqual([...LIMIT_KEYS]);
  });
  it("marks rows near and at the limit", () => {
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey.ai_generations_month).toMatchObject({ percent: 85, nearLimit: true, atLimit: false });
    expect(byKey.social_pages).toMatchObject({ atLimit: true, nearLimit: false, limitText: "3" });
    expect(byKey.campaigns_open).toMatchObject({ percent: null, limitText: "no limit", atLimit: false });
    expect(byKey.media_bytes?.usedText).toBe("1.0 MB");
  });
});

describe("parseNumberMap", () => {
  it("keeps numbers, turns numeric strings into numbers, and drops the rest", () => {
    expect(parseNumberMap({ a: 5, b: "7", c: null, d: "x", e: { z: 1 } })).toEqual({ a: 5, b: 7, c: null, d: null, e: null });
    expect(parseNumberMap(null)).toEqual({});
    expect(parseNumberMap("nope")).toEqual({});
  });
});
