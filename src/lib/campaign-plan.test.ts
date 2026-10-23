import { describe, expect, it } from "vitest";
import {
  addDays,
  buildPlan,
  campaignFormSchema,
  daysBetween,
  isValidDateString,
  localToUtc,
  parseThemes,
  slotsToJson,
  todayInZone,
  weekdayOf,
  type PlanInput,
} from "./campaign-plan";

// A fixed "now": Friday, October 23, 2026, 06:00 UTC (noon in Dhaka).
const NOW = new Date("2026-10-23T06:00:00Z");

const base: PlanInput = {
  startDate: "2026-10-26",
  durationDays: 30,
  itemCount: 12,
  languages: ["en"],
  formats: ["tip", "checklist", "question"],
  postingDays: [1, 2, 3, 4, 5],
  times: ["10:00"],
  themes: [],
  timeZone: "Asia/Dhaka",
  now: NOW,
};

describe("date helpers", () => {
  it("validates calendar dates", () => {
    expect(isValidDateString("2026-02-28")).toBe(true);
    expect(isValidDateString("2026-02-30")).toBe(false);
    expect(isValidDateString("2026-2-3")).toBe(false);
    expect(isValidDateString("")).toBe(false);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2026-10-23", "2026-11-23")).toBe(31);
  });

  it("knows the weekday", () => {
    expect(weekdayOf("2026-10-23")).toBe(5); // Friday
    expect(weekdayOf("2026-10-25")).toBe(0); // Sunday
  });

  it("finds today's date in a timezone", () => {
    const lateUtc = new Date("2026-10-23T20:30:00Z");
    expect(todayInZone(lateUtc, "UTC")).toBe("2026-10-23");
    expect(todayInZone(lateUtc, "Asia/Dhaka")).toBe("2026-10-24"); // already after midnight there
    expect(todayInZone(lateUtc, "America/New_York")).toBe("2026-10-23");
  });

  it("converts local times to UTC", () => {
    expect(localToUtc("2026-10-26", "10:00", "Asia/Dhaka").toISOString()).toBe("2026-10-26T04:00:00.000Z");
    expect(localToUtc("2026-10-26", "10:00", "UTC").toISOString()).toBe("2026-10-26T10:00:00.000Z");
  });

  it("handles daylight saving time on both sides of the change", () => {
    // New York: clocks go back on Sunday, November 1, 2026 (UTC-4 before, UTC-5 after).
    expect(localToUtc("2026-10-31", "10:00", "America/New_York").toISOString()).toBe("2026-10-31T14:00:00.000Z");
    expect(localToUtc("2026-11-02", "10:00", "America/New_York").toISOString()).toBe("2026-11-02T15:00:00.000Z");
  });
});

describe("buildPlan", () => {
  it("spreads the requested posts over posting days only", () => {
    const result = buildPlan(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slots).toHaveLength(12);
    for (const slot of result.slots) {
      const day = weekdayOf(slot.localDate);
      expect(day >= 1 && day <= 5).toBe(true);
      expect(slot.localTime).toBe("10:00");
    }
    // Chronological, no two posts on the same slot, nothing outside the window.
    const times = result.slots.map((s) => s.plannedAt);
    expect([...times].sort()).toEqual(times);
    expect(new Set(times).size).toBe(12);
    expect((result.slots[0]?.localDate ?? "") >= base.startDate).toBe(true);
    expect((result.slots[11]?.localDate ?? "") <= addDays(base.startDate, 29)).toBe(true);
  });

  it("is deterministic", () => {
    expect(buildPlan(base)).toEqual(buildPlan(base));
  });

  it("uses every slot when the count equals the capacity", () => {
    const result = buildPlan({ ...base, durationDays: 7, itemCount: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.slots.map((s) => s.localDate)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]);
  });

  it("puts several posts on one day when several times are chosen", () => {
    const result = buildPlan({ ...base, durationDays: 1, itemCount: 3, postingDays: [1], times: ["18:00", "08:00", "12:00"] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.slots.map((s) => s.localTime)).toEqual(["08:00", "12:00", "18:00"]);
  });

  it("supports 30, 60, and 90 posts", () => {
    for (const [days, count] of [[30, 30], [60, 60], [90, 90]] as const) {
      const result = buildPlan({ ...base, durationDays: days, itemCount: count, postingDays: [0, 1, 2, 3, 4, 5, 6] });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.slots).toHaveLength(count);
    }
  });

  it("rejects more posts than the schedule can hold, with a helpful message", () => {
    const result = buildPlan({ ...base, durationDays: 7, itemCount: 20 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("20 posts");
      expect(result.error).toContain("5 posts");
    }
  });

  it("rejects counts and durations outside the limits", () => {
    expect(buildPlan({ ...base, itemCount: 0 }).ok).toBe(false);
    expect(buildPlan({ ...base, itemCount: 91 }).ok).toBe(false);
    expect(buildPlan({ ...base, durationDays: 0 }).ok).toBe(false);
    expect(buildPlan({ ...base, durationDays: 91 }).ok).toBe(false);
    expect(buildPlan({ ...base, itemCount: 2.5 }).ok).toBe(false);
  });

  it("rejects dates in the past or too far ahead", () => {
    expect(buildPlan({ ...base, startDate: "2026-10-22" }).ok).toBe(false);
    expect(buildPlan({ ...base, startDate: "2028-01-01" }).ok).toBe(false);
    expect(buildPlan({ ...base, startDate: "2026-13-40" }).ok).toBe(false);
  });

  it("skips posting times that already passed today", () => {
    // 06:00 UTC is 12:00 in Dhaka. Starting today, the 10:00 slot has passed.
    const result = buildPlan({ ...base, startDate: "2026-10-23", durationDays: 3, itemCount: 1, postingDays: [0, 1, 2, 3, 4, 5, 6] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.slots[0]?.localDate).toBe("2026-10-24");
  });

  it("explains when no posting day falls in the window", () => {
    const result = buildPlan({ ...base, durationDays: 2, startDate: "2026-10-24", postingDays: [1] }); // Sat-Sun only
    expect(result.ok).toBe(false);
  });

  it("alternates languages and pairs format and angle", () => {
    const result = buildPlan({
      ...base,
      languages: ["en", "bn"],
      itemCount: 6,
      themes: ["Angle A", "Angle B"],
      formats: ["tip", "question", "story"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slots.map((s) => s.language)).toEqual(["en", "bn", "en", "bn", "en", "bn"]);
    expect(result.slots.map((s) => s.format)).toEqual(["tip", "tip", "question", "question", "story", "story"]);
    expect(result.slots.map((s) => s.theme)).toEqual(["Angle A", "Angle A", "Angle B", "Angle B", "Angle A", "Angle A"]);
  });

  it("rotates formats and leaves the angle empty when none is given", () => {
    const result = buildPlan({ ...base, itemCount: 4, formats: ["tip", "story"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.slots.map((s) => s.format)).toEqual(["tip", "story", "tip", "story"]);
      expect(result.slots.every((s) => s.theme === null)).toBe(true);
    }
  });

  it("produces the shape the database function expects", () => {
    const result = buildPlan({ ...base, itemCount: 1 });
    if (!result.ok) throw new Error("plan failed");
    expect(slotsToJson(result.slots)).toEqual([
      { planned_at: result.slots[0]?.plannedAt, language: "en", content_format: "tip", theme: null },
    ]);
  });
});

describe("campaignFormSchema", () => {
  const valid = {
    name: "November tips",
    projectId: "11111111-1111-4111-8111-111111111111",
    topic: "customer service",
    startDate: "2026-10-26",
    durationDays: "30",
    itemCount: "12",
    languages: ["en", "en"],
    formats: ["tip"],
    postingDays: ["5", "1", "1"],
    times: ["10:00", "10:00"],
    length: "medium",
    themes: [],
  };

  it("accepts a good form and cleans lists", () => {
    const parsed = campaignFormSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.durationDays).toBe(30);
      expect(parsed.data.languages).toEqual(["en"]);
      expect(parsed.data.postingDays).toEqual([1, 5]);
      expect(parsed.data.times).toEqual(["10:00"]);
    }
  });

  it("needs a topic or an article link", () => {
    expect(campaignFormSchema.safeParse({ ...valid, topic: undefined }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...valid, topic: undefined, sourceUrl: "https://example.com/a" }).success).toBe(true);
    expect(campaignFormSchema.safeParse({ ...valid, sourceUrl: "ftp://example.com" }).success).toBe(false);
  });

  it("rejects bad numbers, languages, formats, and times", () => {
    expect(campaignFormSchema.safeParse({ ...valid, itemCount: "0" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...valid, itemCount: "91" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...valid, itemCount: "abc" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...valid, durationDays: "91" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...valid, languages: ["fr"] }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...valid, languages: [] }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...valid, formats: ["nonsense"] }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...valid, times: ["25:00"] }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...valid, postingDays: ["9"] }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...valid, projectId: "nope" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...valid, startDate: "2026-02-31" }).success).toBe(false);
  });

  it("limits the number of angles", () => {
    const many = Array.from({ length: 21 }, (_, i) => `Angle ${i}`);
    expect(campaignFormSchema.safeParse({ ...valid, themes: many }).success).toBe(false);
  });
});

describe("parseThemes", () => {
  it("keeps one angle per non-empty line", () => {
    expect(parseThemes("First idea\n\n  Second   idea \r\nThird")).toEqual(["First idea", "Second idea", "Third"]);
    expect(parseThemes("")).toEqual([]);
  });
});
