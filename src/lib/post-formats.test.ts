import { describe, expect, it } from "vitest";
import { POST_LENGTHS, POST_LENGTH_VALUES, maxTokensFor } from "./post-formats";

describe("post lengths", () => {
  it("offers an extra long option of 500 to 750 words", () => {
    expect(POST_LENGTH_VALUES).toContain("extra_long");
    expect(POST_LENGTHS.find((l) => l.value === "extra_long")?.label).toBe("Extra long (500 to 750 words)");
  });

  it("gives longer posts and Bengali more room, within a cap", () => {
    expect(maxTokensFor("extra_long", "en")).toBeGreaterThan(maxTokensFor("long", "en"));
    expect(maxTokensFor("medium", "bn")).toBe(maxTokensFor("medium", "en") * 2);
    expect(maxTokensFor("extra_long", "bn")).toBeLessThanOrEqual(8000);
  });
});
