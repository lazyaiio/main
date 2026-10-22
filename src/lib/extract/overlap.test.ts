import { describe, expect, it } from "vitest";
import { sourceOverlap } from "./overlap";

const SOURCE =
  "Small businesses that reply to customer comments within a day build trust faster and see more repeat visits, according to the owner of a local bakery who tracked her results for a year.";

describe("sourceOverlap", () => {
  it("is high for copied text and low for a rewrite", () => {
    expect(sourceOverlap(SOURCE, SOURCE)).toBe(1);
    const rewrite = "Answering your customers quickly on social media shows you care. One bakery owner noticed that people came back more often after she started doing this.";
    expect(sourceOverlap(rewrite, SOURCE)).toBeLessThan(0.1);
  });

  it("ignores case and punctuation", () => {
    expect(sourceOverlap(SOURCE.toUpperCase().replace(/,/g, ";;"), SOURCE)).toBe(1);
  });

  it("catches partial copying", () => {
    const mixed = `Here is my take. ${SOURCE.split(", ")[0]}, and I think that matters a lot for every shop owner today.`;
    expect(sourceOverlap(mixed, SOURCE)).toBeGreaterThan(0.25);
  });

  it("returns 0 for very short posts and empty sources", () => {
    expect(sourceOverlap("too short", SOURCE)).toBe(0);
    expect(sourceOverlap(SOURCE, "")).toBe(0);
  });

  it("works for Bengali script", () => {
    const text = "\u099b\u09cb\u099f \u09ac\u09cd\u09af\u09ac\u09b8\u09be\u09b0 \u099c\u09a8\u09cd\u09af \u098f\u0995\u099f\u09bf \u09b8\u09b9\u099c \u09aa\u09b0\u09be\u09ae\u09b0\u09cd\u09b6 \u0986\u099c\u0995\u09c7\u09b0 \u099f\u09bf\u09aa";
    expect(sourceOverlap(text, text)).toBe(1);
  });
});
