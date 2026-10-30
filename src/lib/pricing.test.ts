import { describe, expect, it } from "vitest";
import { formatPrice, limitHighlights, parseFeatureLines, parseLimitField, parsePriceField, yearlySavingsPercent } from "./pricing";

describe("formatPrice", () => {
  it("uses the currency code and no decimals for whole numbers", () => {
    expect(formatPrice(1500, "BDT")).toBe("BDT 1,500");
    expect(formatPrice(9.9, "USD")).toBe("USD 9.90");
  });
});

describe("yearlySavingsPercent", () => {
  it("reports the saving of paying yearly", () => {
    expect(yearlySavingsPercent(100, 1000)).toBe(17);
  });
  it("is null when there is no saving or a price is missing", () => {
    expect(yearlySavingsPercent(100, 1200)).toBeNull();
    expect(yearlySavingsPercent(null, 1000)).toBeNull();
    expect(yearlySavingsPercent(0, 0)).toBeNull();
  });
});

describe("admin form parsing", () => {
  it("parses feature lines", () => {
    expect(parseFeatureLines("- One\n\n  Two  \n* Three")).toEqual(["One", "Two", "Three"]);
    expect(parseFeatureLines(Array.from({ length: 30 }, (_, i) => `f${i}`).join("\n")).length).toBe(20);
  });
  it("parses limits", () => {
    expect(parseLimitField("100")).toBe(100);
    expect(parseLimitField("")).toBeNull();
    expect(parseLimitField("-5")).toBeUndefined();
    expect(parseLimitField("1e3")).toBeUndefined();
  });
  it("parses prices", () => {
    expect(parsePriceField("1,500")).toBe(1500);
    expect(parsePriceField("9.99")).toBe(9.99);
    expect(parsePriceField("")).toBeNull();
    expect(parsePriceField("9.999")).toBeUndefined();
    expect(parsePriceField("abc")).toBeUndefined();
  });
});

describe("limitHighlights", () => {
  it("describes AI posts and Pages", () => {
    expect(limitHighlights({ ai_generations_month: 1000, social_pages: 1 })).toEqual(["1,000 AI posts per month", "1 Facebook Page"]);
  });
});
