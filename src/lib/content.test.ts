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

describe("post status (no review step)", () => {
  it("lets a ready post be canceled and a canceled post be restored", () => {
    expect(allowedTransitions("approved")).toEqual(["cancelled"]);
    expect(allowedTransitions("cancelled")).toEqual(["approved"]);
    expect(canTransition("approved", "cancelled")).toBe(true);
    expect(canTransition("cancelled", "approved")).toBe(true);
  });

  it("never sends a post back to a review state", () => {
    expect(canTransition("approved", "draft")).toBe(false);
    expect(canTransition("approved", "awaiting_approval")).toBe(false);
    expect(canTransition("cancelled", "rejected")).toBe(false);
  });

  it("treats older values as ready", () => {
    expect(canTransition("draft", "approved")).toBe(true);
    expect(canTransition("awaiting_approval", "approved")).toBe(true);
    expect(canTransition("rejected", "approved")).toBe(true);
  });

  it("allows deleting any post (a schedule still protects its post in the database)", () => {
    expect(isDeletable("approved")).toBe(true);
    expect(isDeletable("cancelled")).toBe(true);
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
