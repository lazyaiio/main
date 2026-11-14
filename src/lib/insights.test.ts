import { describe, expect, it } from "vitest";
import { INSIGHT_RANGES, PAGE_METRICS, POST_METRICS, canRefresh, changeText, fillDays, insightsAccess, insightsWindow, parseDailyPoints, parseLifetimeValues, postTitle, snapshotSchema, summarize } from "./insights";

const now = new Date("2026-11-08T10:00:00Z");

describe("insightsWindow", () => {
  it("covers twice the range, ending at the start of today (UTC), and names the current days", () => {
    const w = insightsWindow(7, now);
    expect(w.until.toISOString()).toBe("2026-11-08T00:00:00.000Z");
    expect(w.since.toISOString()).toBe("2026-10-25T00:00:00.000Z");
    expect(w.currentFrom).toBe("2026-11-01");
    expect(w.currentTo).toBe("2026-11-07");
  });
  it("never asks for more than 90 days", () => {
    for (const r of INSIGHT_RANGES) {
      const w = insightsWindow(r, now);
      expect((w.until.getTime() - w.since.getTime()) / 86_400_000).toBeLessThanOrEqual(90);
    }
  });
});

describe("parseDailyPoints", () => {
  const body = { data: [{ name: "page_media_view", period: "day", values: [{ value: 12, end_time: "2026-11-03T08:00:00+0000" }, { value: 5, end_time: "2026-11-02T08:00:00+0000" }, { value: { like: 3, love: 2 }, end_time: "2026-11-04T08:00:00+0000" }] }] };
  it("dates each value as the day before its end time, sorted, and sums breakdown objects", () => {
    expect(parseDailyPoints(body)).toEqual([{ date: "2026-11-01", value: 5 }, { date: "2026-11-02", value: 12 }, { date: "2026-11-03", value: 5 }]);
  });
  it("tells an empty answer from a wrong one", () => {
    expect(parseDailyPoints({ data: [] })).toEqual([]);
    expect(parseDailyPoints({ nope: 1 })).toBeNull();
    expect(parseDailyPoints(null)).toBeNull();
  });
  it("skips values that are not numbers", () => {
    expect(parseDailyPoints({ data: [{ values: [{ value: "x", end_time: "2026-11-03T08:00:00+0000" }, { value: 4, end_time: "bad" }] }] })).toEqual([]);
  });
});

describe("parseLifetimeValues", () => {
  it("reads one number per metric, summing reaction types", () => {
    const out = parseLifetimeValues({ data: [{ name: "post_media_view", values: [{ value: 90 }] }, { name: "post_reactions_by_type_total", values: [{ value: { like: 10, love: 4 } }] }, { name: "post_clicks", values: [] }] });
    expect(out).toEqual({ post_media_view: 90, post_reactions_by_type_total: 14 });
  });
});

describe("summarize", () => {
  const points = [
    { date: "2026-10-28", value: 10 }, { date: "2026-10-30", value: 10 },
    { date: "2026-11-02", value: 15 }, { date: "2026-11-05", value: 15 },
  ];
  it("totals the current range and compares it with the one before", () => {
    const s = summarize(points, 7, now);
    expect(s.total).toBe(30);
    expect(s.previousTotal).toBe(20);
    expect(s.changePct).toBe(50);
    expect(s.points).toHaveLength(2);
  });
  it("gives no percentage without a previous period or when it was zero", () => {
    expect(summarize([{ date: "2026-11-02", value: 5 }], 7, now).changePct).toBeNull();
    expect(summarize([{ date: "2026-10-30", value: 0 }, { date: "2026-11-02", value: 5 }], 7, now).changePct).toBeNull();
  });
  it("words the change", () => {
    expect(changeText(50)).toBe("+50%");
    expect(changeText(-12)).toBe("-12%");
    expect(changeText(0)).toBe("No change");
    expect(changeText(null)).toBeNull();
  });
});

describe("fillDays", () => {
  it("gives one point per day with zeros for gaps", () => {
    expect(fillDays([{ date: "2026-11-02", value: 4 }], "2026-11-01", "2026-11-03")).toEqual([{ date: "2026-11-01", value: 0 }, { date: "2026-11-02", value: 4 }, { date: "2026-11-03", value: 0 }]);
  });
});

describe("postTitle", () => {
  it("uses the hook, else the body, on one line, and shortens long text", () => {
    expect(postTitle("Fresh bread today", "Long body")).toBe("Fresh bread today");
    expect(postTitle(null, "Line one\n\nline two")).toBe("Line one line two");
    expect(postTitle(null, "x".repeat(200))).toHaveLength(90);
    expect(postTitle("  ", " ")).toBe("Untitled post");
  });
});

describe("access and refresh rules", () => {
  it("needs the feature, a connected Page and the granted permission", () => {
    const ok = { featureOn: true, pageConnected: true, grantedScopes: ["pages_show_list", "read_insights"] };
    expect(insightsAccess(ok).state).toBe("ready");
    expect(insightsAccess({ ...ok, pageConnected: false }).state).toBe("page_not_connected");
    expect(insightsAccess({ ...ok, featureOn: false }).state).toBe("not_enabled");
    expect(insightsAccess({ ...ok, grantedScopes: ["pages_show_list"] }).state).toBe("needs_reconnect");
  });
  it("does not ask Facebook again within the cooldown", () => {
    expect(canRefresh(null, now)).toBe(true);
    expect(canRefresh("2026-11-08T09:45:00Z", now)).toBe(false);
    expect(canRefresh("2026-11-08T09:20:00Z", now)).toBe(true);
  });
});

describe("definitions and stored shape", () => {
  it("uses unique keys and graph names, none of the retired unique-impression names", () => {
    const names = [...PAGE_METRICS.map((m) => m.graph), ...POST_METRICS.map((m) => m.graph)];
    expect(new Set(PAGE_METRICS.map((m) => m.key)).size).toBe(PAGE_METRICS.length);
    for (const n of names) expect(n).not.toMatch(/impressions/);
  });
  it("accepts a good snapshot and rejects a broken one", () => {
    const good = { rangeDays: 7, currentFrom: "2026-11-01", currentTo: "2026-11-07", page: { followers: 120, likes: 118 }, metrics: [{ key: "views", total: 10, previousTotal: 5, changePct: 100, points: [{ date: "2026-11-01", value: 10 }], problem: null }], posts: [] };
    expect(snapshotSchema.safeParse(good).success).toBe(true);
    expect(snapshotSchema.safeParse({ ...good, rangeDays: 14 }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...good, metrics: [{ key: "views", total: "10" }] }).success).toBe(false);
  });
  it("uses no Bengali", () => {
    expect(JSON.stringify([PAGE_METRICS, POST_METRICS])).not.toMatch(/[\u0980-\u09FF]/);
  });
});
