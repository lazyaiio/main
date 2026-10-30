import { describe, expect, it } from "vitest";
import { DEFAULT_HOME, formatPairLines, normalizeHome, parseLines, parsePairLines, validateHome } from "./home-content";

describe("normalizeHome", () => {
  it("returns the built-in content for empty or broken data", () => {
    expect(normalizeHome(null)).toEqual(DEFAULT_HOME);
    expect(normalizeHome("nope")).toEqual(DEFAULT_HOME);
    expect(normalizeHome({ hero: 5, faq: { items: "x" } })).toEqual(DEFAULT_HOME);
  });

  it("keeps valid edits and falls back for the rest", () => {
    const home = normalizeHome({ hero: { titleLead: "Hello." }, faq: { items: [{ q: "Q?", a: "A." }, { q: "", a: "dropped" }] } });
    expect(home.hero.titleLead).toBe("Hello.");
    expect(home.hero.titleAccent).toBe(DEFAULT_HOME.hero.titleAccent);
    expect(home.faq.items).toEqual([{ q: "Q?", a: "A." }]);
  });

  it("limits lengths", () => {
    expect(normalizeHome({ hero: { primaryCta: "x".repeat(500) } }).hero.primaryCta.length).toBe(40);
  });
});

describe("text boxes", () => {
  it("round-trips Title | Body lines", () => {
    const text = formatPairLines(DEFAULT_HOME.how.steps);
    expect(parsePairLines(text)).toEqual(DEFAULT_HOME.how.steps);
  });
  it("ignores lines without a separator or a body", () => {
    expect(parsePairLines("no separator\nTitle | \n | body\nOk | fine")).toEqual([{ title: "Ok", body: "fine" }]);
  });
  it("splits plain lines", () => {
    expect(parseLines("a\n\n b \n")).toEqual(["a", "b"]);
  });
});

describe("validateHome", () => {
  it("accepts the built-in content", () => {
    expect(validateHome(DEFAULT_HOME)).toBeNull();
  });
  it("refuses Bengali characters", () => {
    expect(validateHome({ ...DEFAULT_HOME, cta: { ...DEFAULT_HOME.cta, button: "\u09B6\u09C1\u09B0\u09C1" } })).toContain("English");
  });
  it("needs at least one entry in each list", () => {
    expect(validateHome({ ...DEFAULT_HOME, faq: { ...DEFAULT_HOME.faq, items: [] } })).toContain("at least one");
  });
});
