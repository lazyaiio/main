import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  canTransition,
  contentFormSchema,
  formatHashtagsForInput,
  hashContent,
  isDeletable,
  manualPostSchema,
  parseHashtags,
} from "./content";

describe("hashContent", () => {
  it("ignores case, punctuation, and spacing but not wording", () => {
    expect(hashContent("Hello, World!")).toBe(hashContent("  hello   world "));
    expect(hashContent("Hello world")).not.toBe(hashContent("Hello there"));
  });

  it("works for non-Latin text", () => {
    expect(hashContent("\u099b\u09cb\u099f \u09ac\u09cd\u09af\u09ac\u09b8\u09be")).toHaveLength(64);
  });
});

describe("hashtags", () => {
  it("parses spaces, commas and # signs", () => {
    expect(parseHashtags("#tips, #small  business")).toEqual(["tips", "small", "business"]);
    expect(formatHashtagsForInput(["a", "b"])).toBe("#a #b");
  });
});

describe("approval workflow", () => {
  it("only allows sensible transitions", () => {
    expect(canTransition("draft", "awaiting_approval")).toBe(true);
    expect(canTransition("draft", "approved")).toBe(false);
    expect(canTransition("awaiting_approval", "approved")).toBe(true);
    expect(canTransition("rejected", "approved")).toBe(false);
    expect(allowedTransitions("approved")).toEqual(["draft", "cancelled"]);
  });

  it("protects approved and in-review posts from deletion", () => {
    expect(isDeletable("draft")).toBe(true);
    expect(isDeletable("approved")).toBe(false);
    expect(isDeletable("awaiting_approval")).toBe(false);
  });
});

describe("form schemas", () => {
  it("requires post text", () => {
    expect(contentFormSchema.safeParse({ body: "  " }).success).toBe(false);
    expect(contentFormSchema.safeParse({ body: "Hi" }).success).toBe(true);
  });

  it("accepts a manual post with or without a project", () => {
    expect(manualPostSchema.safeParse({ projectId: "", language: "en", body: "Hi" }).success).toBe(true);
    expect(manualPostSchema.safeParse({ language: "en", body: "Hi" }).success).toBe(true);
    expect(manualPostSchema.safeParse({ projectId: "bad", language: "en", body: "Hi" }).success).toBe(false);
  });
});
