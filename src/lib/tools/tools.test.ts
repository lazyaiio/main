import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES, GOALS, generateIdeas, type BusinessType, type Goal } from "./post-ideas";
import { THEMES, buildCalendar, csvCell, parseDate, toCsv } from "./calendar";
import { analyze, suggestions } from "./post-checker";
import { engagementRates, parseCount } from "./engagement";
import { buildUtmUrl, cleanUtmValue } from "./utm";
import { cleanHashtags } from "./hashtags";
import { MAX_ENTRIES, drawWinners, parseEntries, secureRandomInt } from "./giveaway";
import { COMMON_ZONES, convertToZones, isValidZone, offsetMinutes, zonedInstant } from "./timezones";
import { followerGrowth } from "./growth";

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

describe("engagement rate calculator", () => {
  const base = { followers: 1000, posts: 4, reactions: 100, comments: 20, shares: 10, clicks: 10, totalReach: 5600 };
  it("works out engagements, the average per post, and both rates", () => {
    expect(engagementRates(base)).toEqual({ ok: true, engagements: 140, perPost: 35, rateByFollowers: 3.5, rateByReach: 2.5 });
  });
  it("leaves the reach rate out when no reach is given", () => {
    const r = engagementRates({ ...base, totalReach: 0 });
    expect(r.ok && r.rateByReach).toBeNull();
  });
  it("asks for followers and posts, and rejects bad numbers", () => {
    expect(engagementRates({ ...base, followers: 0 }).ok).toBe(false);
    expect(engagementRates({ ...base, posts: 0 }).ok).toBe(false);
    expect(engagementRates({ ...base, reactions: -1 }).ok).toBe(false);
    expect(engagementRates({ ...base, comments: Number.NaN }).ok).toBe(false);
  });
  it("reads typed numbers", () => {
    expect(parseCount("1,200")).toBe(1200);
    expect(parseCount(" 45 ")).toBe(45);
    expect(parseCount("")).toBe(0);
    expect(Number.isNaN(parseCount("12k"))).toBe(true);
    expect(Number.isNaN(parseCount("-3"))).toBe(true);
  });
});

describe("campaign link (UTM) builder", () => {
  const input = { url: "https://example.com/shop", source: "Facebook", medium: "social", campaign: "Spring Sale", term: "", content: "" };
  it("adds the three required parameters, cleaned", () => {
    const r = buildUtmUrl(input);
    expect(r).toEqual({ ok: true, url: "https://example.com/shop?utm_source=facebook&utm_medium=social&utm_campaign=spring-sale", added: ["utm_source", "utm_medium", "utm_campaign"] });
  });
  it("keeps other parameters and the section, and replaces old UTM values", () => {
    const r = buildUtmUrl({ ...input, url: "example.com/p?ref=1&utm_source=old#reviews", term: "bread", content: "post 1" });
    expect(r.ok && r.url).toBe("https://example.com/p?ref=1&utm_source=facebook&utm_medium=social&utm_campaign=spring-sale&utm_term=bread&utm_content=post-1#reviews");
  });
  it("rejects bad addresses and missing fields", () => {
    expect(buildUtmUrl({ ...input, url: "" }).ok).toBe(false);
    expect(buildUtmUrl({ ...input, url: "javascript:alert(1)" }).ok).toBe(false);
    expect(buildUtmUrl({ ...input, url: "ftp://example.com" }).ok).toBe(false);
    expect(buildUtmUrl({ ...input, url: "localhost" }).ok).toBe(false);
    expect(buildUtmUrl({ ...input, source: " " }).ok).toBe(false);
    expect(buildUtmUrl({ ...input, campaign: "!!!" }).ok).toBe(false);
  });
  it("cleans values", () => {
    expect(cleanUtmValue("  Black Friday! 2026 ")).toBe("black-friday-2026");
  });
});

describe("hashtag cleaner", () => {
  it("cleans a messy list of tags", () => {
    const r = cleanHashtags("#Bakery, #fresh bread #bakery #### #123 #Sourdough!");
    expect(r.tags).toEqual(["#Bakery", "#freshbread", "#Sourdough"]);
    expect(r.duplicates).toBe(1);
    expect(r.dropped).toBe(1);
    expect(r.text).toBe("#Bakery #freshbread #Sourdough");
  });
  it("turns a plain list into tags, in the chosen style", () => {
    expect(cleanHashtags("small business, fresh bread", "camel").tags).toEqual(["#SmallBusiness", "#FreshBread"]);
    expect(cleanHashtags("small business, fresh bread", "lower").tags).toEqual(["#smallbusiness", "#freshbread"]);
    expect(cleanHashtags("bakery bread cake").tags).toEqual(["#bakery", "#bread", "#cake"]);
  });
  it("limits the number of tags and says how many were left out", () => {
    const r = cleanHashtags("a1, b1, c1, d1", "keep", 2);
    expect(r.tags).toEqual(["#a1", "#b1"]);
    expect(r.overLimit).toBe(2);
  });
  it("handles empty input and other scripts safely", () => {
    expect(cleanHashtags("   ").tags).toEqual([]);
    expect(cleanHashtags("#café #naïve").tags).toEqual(["#café", "#naïve"]);
  });
});

describe("giveaway winner picker", () => {
  it("reads one entry per line, skipping blanks and optionally repeats", () => {
    const r = parseEntries("Ana\n  ben  \n\nANA\nCara\n", true);
    expect(r.entries).toEqual(["Ana", "ben", "Cara"]);
    expect(r.duplicates).toBe(1);
    expect(r.blank).toBeGreaterThan(0);
    expect(parseEntries("Ana\nana", false).entries).toHaveLength(2);
  });
  it("caps the list and the length of a line", () => {
    expect(parseEntries(Array.from({ length: MAX_ENTRIES + 5 }, (_, i) => `n${i}`).join("\n"), true).tooMany).toBe(true);
    expect(parseEntries("x".repeat(500), true).entries[0]).toHaveLength(120);
  });
  it("draws different winners and backups with the given random source", () => {
    const first = drawWinners(["a", "b", "c", "d", "e"], 2, 1, () => 0);
    expect(first.ok && first.winners).toHaveLength(2);
    const r = drawWinners(["a", "b", "c", "d", "e"], 2, 1, (n) => n - 1);
    expect(r.ok && new Set([...r.winners, ...r.backups]).size).toBe(3);
  });
  it("lets one person win only once even if listed twice, and refuses impossible requests", () => {
    const r = drawWinners(["a", "A", "b"], 2, 0, (n) => n - 1);
    expect(r.ok && new Set(r.winners.map((w) => w.toLowerCase())).size).toBe(2);
    expect(drawWinners(["a", "A"], 2, 0, () => 0).ok).toBe(false);
    expect(drawWinners([], 1, 0, () => 0).ok).toBe(false);
    expect(drawWinners(["a"], 0, 0, () => 0).ok).toBe(false);
    expect(drawWinners(["a"], 99, 0, () => 0).ok).toBe(false);
  });
  it("gives every entry the same chance (a fair shuffle)", () => {
    let seed = 12345;
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor((seed / 2147483648) * n); };
    const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
    for (let i = 0; i < 4000; i += 1) {
      const r = drawWinners(["a", "b", "c", "d"], 1, 0, rnd);
      if (r.ok) counts[r.winners[0]!]! += 1;
    }
    for (const v of Object.values(counts)) expect(v).toBeGreaterThan(850);
  });
  it("rejects biased random values from the secure source", () => {
    const values = [0xffffffff, 7];
    let i = 0;
    expect(secureRandomInt(10, (a) => { a[0] = values[i++]!; return a; })).toBe(7);
    expect(() => secureRandomInt(0)).toThrow();
    expect(secureRandomInt(1)).toBe(0);
  });
});

describe("time zone converter", () => {
  it("knows zone offsets, including daylight saving", () => {
    expect(offsetMinutes("Asia/Dhaka", new Date("2026-11-09T12:00:00Z"))).toBe(360);
    expect(offsetMinutes("America/New_York", new Date("2026-11-09T12:00:00Z"))).toBe(-300);
    expect(offsetMinutes("America/New_York", new Date("2026-07-01T12:00:00Z"))).toBe(-240);
    expect(offsetMinutes("Europe/London", new Date("2026-07-01T12:00:00Z"))).toBe(60);
  });
  it("turns a wall-clock time into an exact moment and shows it everywhere", () => {
    const i = zonedInstant("2026-11-09", "18:30", "Asia/Dhaka");
    expect(i.ok && i.utc.toISOString()).toBe("2026-11-09T12:30:00.000Z");
    if (!i.ok) throw new Error("unreachable");
    const rows = convertToZones(i.utc, "Asia/Dhaka", COMMON_ZONES);
    const row = (z: string) => rows.find((r) => r.zone === z)!;
    expect(row("Asia/Dhaka").time).toBe("6:30 PM");
    expect(row("America/New_York").time).toBe("7:30 AM");
    expect(row("Europe/London").time).toBe("12:30 PM");
    expect(row("America/Los_Angeles").time).toBe("4:30 AM");
    expect(row("Australia/Sydney").time).toBe("11:30 PM");
    expect(row("Asia/Dhaka").offset).toBe("UTC+06:00");
  });
  it("marks when the date changes", () => {
    const i = zonedInstant("2026-11-09", "02:00", "Asia/Dhaka");
    if (!i.ok) throw new Error("unreachable");
    const rows = convertToZones(i.utc, "Asia/Dhaka", COMMON_ZONES);
    expect(rows.find((r) => r.zone === "America/New_York")?.dayShift).toBe(-1);
    expect(rows.find((r) => r.zone === "Asia/Dhaka")?.dayShift).toBe(0);
  });
  it("handles clock changes: a skipped time moves forward, a repeated time uses the first one", () => {
    const skipped = zonedInstant("2026-03-08", "02:30", "America/New_York");
    expect(skipped.ok && skipped.note).toBe("skipped");
    expect(skipped.ok && skipped.utc.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    const repeated = zonedInstant("2026-11-01", "01:30", "America/New_York");
    expect(repeated.ok && repeated.note).toBe("repeated");
    expect(repeated.ok && repeated.utc.toISOString()).toBe("2026-11-01T05:30:00.000Z");
    const summer = zonedInstant("2026-07-01", "12:00", "Europe/London");
    expect(summer.ok && summer.utc.toISOString()).toBe("2026-07-01T11:00:00.000Z");
  });
  it("rejects bad input", () => {
    expect(zonedInstant("", "10:00", "Asia/Dhaka").ok).toBe(false);
    expect(zonedInstant("2026-02-30", "10:00", "Asia/Dhaka").ok).toBe(false);
    expect(zonedInstant("2026-11-09", "25:00", "Asia/Dhaka").ok).toBe(false);
    expect(zonedInstant("2026-11-09", "10:00", "Mars/Base").ok).toBe(false);
    expect(isValidZone("Asia/Dhaka")).toBe(true);
    expect(isValidZone("../etc")).toBe(false);
  });
});

describe("follower growth calculator", () => {
  it("works out growth, the pace, and a straight-line projection", () => {
    expect(followerGrowth({ start: 1000, end: 1140, days: 28, projectDays: 28 })).toEqual({ ok: true, net: 140, percent: 14, perDay: 5, perWeek: 35, projected: 1280, projectDays: 28, direction: "up" });
  });
  it("handles loss, no change, and no starting followers", () => {
    const down = followerGrowth({ start: 200, end: 180, days: 10, projectDays: 100 });
    expect(down.ok && down.direction).toBe("down");
    expect(down.ok && down.projected).toBe(0);
    expect(followerGrowth({ start: 50, end: 50, days: 7, projectDays: 7 })).toMatchObject({ ok: true, direction: "flat", percent: 0 });
    expect(followerGrowth({ start: 0, end: 10, days: 5, projectDays: 5 })).toMatchObject({ ok: true, percent: null });
  });
  it("rejects bad numbers", () => {
    expect(followerGrowth({ start: -1, end: 5, days: 5, projectDays: 5 }).ok).toBe(false);
    expect(followerGrowth({ start: 1, end: 5, days: 0, projectDays: 5 }).ok).toBe(false);
    expect(followerGrowth({ start: 1, end: 5, days: 99999, projectDays: 5 }).ok).toBe(false);
    expect(followerGrowth({ start: 1, end: Number.NaN, days: 5, projectDays: 5 }).ok).toBe(false);
  });
});
