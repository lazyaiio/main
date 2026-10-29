import { describe, expect, it } from "vitest";
import { pickPhoto, stockQueryCandidates } from "./stock-query";

describe("stockQueryCandidates", () => {
  it("turns an image idea into short searches, most specific first", () => {
    const list = stockQueryCandidates("A close-up photo of a barista pouring latte art in a cozy coffee shop", "Coffee shop marketing");
    expect(list[0]).toBe("close-up barista pouring latte art");
    expect(list.every((q) => q.length >= 2)).toBe(true);
    expect(list.length).toBeLessThanOrEqual(4);
  });

  it("falls back to the topic, then to a generic search", () => {
    expect(stockQueryCandidates(null, "Winter garden tips")).toContain("winter garden tips");
    expect(stockQueryCandidates("", "")).toEqual(["business"]);
  });

  it("never repeats a phrase", () => {
    const list = stockQueryCandidates("coffee", "coffee");
    expect(new Set(list).size).toBe(list.length);
  });
});

describe("pickPhoto", () => {
  const photo = (id: number, width: number, height: number) => ({ width, height, sourcePageUrl: `https://example.test/${id}` });

  it("prefers a large landscape photo", () => {
    expect(pickPhoto([photo(1, 800, 1200), photo(2, 3000, 2000)], new Set())?.sourcePageUrl).toBe("https://example.test/2");
  });

  it("skips photos that were already used", () => {
    expect(pickPhoto([photo(1, 3000, 2000), photo(2, 3000, 2000)], new Set(["https://example.test/1"]))?.sourcePageUrl).toBe("https://example.test/2");
  });

  it("returns null when everything was used", () => {
    expect(pickPhoto([photo(1, 3000, 2000)], new Set(["https://example.test/1"]))).toBeNull();
  });
});
