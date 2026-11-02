import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES, GOALS, generateIdeas, type BusinessType, type Goal } from "./post-ideas";
import { THEMES, buildCalendar, csvCell, parseDate, toCsv } from "./calendar";
import { analyze, suggestions } from "./post-checker";

describe("post idea generator", () => {
  it("gives twelve complete ideas for every business and goal, with no leftover placeholders", () => {
    for (const business of Object.keys(BUSINESS_TYPES) as BusinessType[]) {
      for (const goal of GOALS.map((g) => g.value) as Goal[]) {
        for (const round of [0, 1, 2]) {
          const ideas = generateIdeas({ business, goal, round });
          expect(ideas).toHaveLength(12);
          for (const i of ideas) {
            expect(`${i.title}${i.idea}${i.opener}`).not.toContain("{");
            expect(i.idea.length).toBeGreaterThan(30);
          }
        }
      }
    }
  });
  it("is repeatable, and a new round gives different ideas", () => {
    const a = generateIdeas({ business: "restaurant", goal: "sales", round: 0 });
    expect(generateIdeas({ business: "restaurant", goal: "sales", round: 0 })).toEqual(a);
    expect(generateIdeas({ business: "restaurant", goal: "sales", round: 1 })).not.toEqual(a);
  });
  it("uses the product the person typed", () => {
    const ideas = generateIdeas({ business: "salon", goal: "awareness", product: "bridal makeup" });
    expect(ideas.some((i) => i.idea.includes("bridal makeup"))).toBe(true);
  });
  it("puts offers first when the goal is sales", () => {
    expect(generateIdeas({ business: "ecommerce", goal: "sales" })[0]?.title).toBe("Offer or announcement");
  });
});

describe("content calendar", () => {
  const base = { start: "2026-11-02", weeks: 2, perWeek: 3, days: [0, 2, 4], time: "10:00", themes: THEMES.map((t) => t.name) as string[] };
  it("plans the chosen weekdays and rotates the themes", () => {
    const r = buildCalendar(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows.map((x) => x.date)).toEqual(["2026-11-02", "2026-11-04", "2026-11-06", "2026-11-09", "2026-11-11", "2026-11-13"]);
      expect(r.rows[0]?.weekday).toBe("Monday");
      expect(new Set(r.rows.map((x) => x.theme)).size).toBe(6);
    }
  });
  it("starts from the chosen date, not earlier in that week", () => {
    const r = buildCalendar({ ...base, start: "2026-11-04" });
    expect(r.ok && r.rows[0]?.date).toBe("2026-11-04");
  });
  it("limits posts per week to the days chosen", () => {
    const r = buildCalendar({ ...base, perWeek: 7 });
    expect(r.ok && r.rows.length).toBe(6);
  });
  it("refuses bad input", () => {
    expect(buildCalendar({ ...base, start: "2026-02-30" }).ok).toBe(false);
    expect(buildCalendar({ ...base, weeks: 13 }).ok).toBe(false);
    expect(buildCalendar({ ...base, days: [] }).ok).toBe(false);
    expect(buildCalendar({ ...base, themes: [] }).ok).toBe(false);
    expect(buildCalendar({ ...base, time: "25:00" }).ok).toBe(false);
  });
  it("parses dates strictly", () => {
    expect(parseDate("2026-11-02")?.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(parseDate("11/02/2026")).toBeNull();
  });
  it("writes safe CSV", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    const r = buildCalendar(base);
    expect(r.ok && toCsv(r.rows).split("\r\n")[0]).toBe("Date,Day,Time,Theme,What to post,Your post text");
  });
});

describe("post checker", () => {
  it("measures a post", () => {
    const m = analyze("Fresh bread is ready.\n\nCome by before noon! Tell us your favorite. #bakery #fresh https://example.com");
    expect(m.words).toBeGreaterThan(10);
    expect(m.paragraphs).toBe(2);
    expect(m.hashtags).toBe(2);
    expect(m.links).toBe(1);
    expect(m.hasCallToAction).toBe(true);
    expect(m.firstLine).toBe("Fresh bread is ready.");
  });
  it("counts emojis, questions and shouting", () => {
    const m = analyze("WOW this is AMAZING 😀🎉 Do you agree?");
    expect(m.emojis).toBe(2);
    expect(m.questions).toBe(1);
    expect(m.capsWords).toBe(2);
  });
  it("handles an empty text", () => {
    const m = analyze("   ");
    expect(m.words).toBe(0);
    expect(suggestions(m)).toEqual([]);
  });
  it("gives helpful suggestions for a weak post", () => {
    const text = "We are so happy to announce that after a very long period of careful consideration and planning we have finally decided to launch our brand new product which we believe will change the way that everybody thinks about the whole category of products in this market #a #b #c #d #e";
    const tips = suggestions(analyze(text));
    expect(tips.some((t) => t.level === "check" && /next step/.test(t.text))).toBe(true);
    expect(tips.some((t) => t.level === "check" && /hashtags/.test(t.text))).toBe(true);
  });
  it("is happy with a clear post", () => {
    const tips = suggestions(analyze("Fresh bread today.\n\nWe baked it at dawn. Come by before noon and tell us your favorite."));
    expect(tips.filter((t) => t.level === "check")).toEqual([]);
  });
});
