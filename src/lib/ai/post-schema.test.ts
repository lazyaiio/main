import { describe, expect, it } from "vitest";
import { checkLanguage, cleanHashtags, extractJsonObject, postOutputSchema, postRequestSchema } from "./post-schema";

const BN_SENTENCE = "\u099b\u09cb\u099f \u09ac\u09cd\u09af\u09ac\u09b8\u09be\u09b0 \u099c\u09a8\u09cd\u09af \u098f\u0995\u099f\u09bf \u09b8\u09b9\u099c \u09aa\u09b0\u09be\u09ae\u09b0\u09cd\u09b6";

describe("postRequestSchema", () => {
  const base = {
    projectId: "11111111-1111-4111-8111-111111111111",
    language: "en",
    format: "tip",
    topic: "local marketing",
    length: "medium",
  };

  it("accepts a valid request", () => {
    expect(postRequestSchema.safeParse(base).success).toBe(true);
  });

  it("accepts an article link with no topic, but needs one or the other", () => {
    const withoutTopic = { projectId: base.projectId, language: base.language, format: base.format, length: base.length };
    expect(postRequestSchema.safeParse({ ...withoutTopic, sourceUrl: "https://example.com/a" }).success).toBe(true);
    expect(postRequestSchema.safeParse(withoutTopic).success).toBe(false);
    expect(postRequestSchema.safeParse({ ...withoutTopic, topic: " " }).success).toBe(false);
  });

  it("rejects unknown formats, languages, and short topics", () => {
    expect(postRequestSchema.safeParse({ ...base, format: "meme" }).success).toBe(false);
    expect(postRequestSchema.safeParse({ ...base, language: "fr" }).success).toBe(false);
    expect(postRequestSchema.safeParse({ ...base, topic: "a" }).success).toBe(false);
    expect(postRequestSchema.safeParse({ ...base, projectId: "nope" }).success).toBe(false);
  });
});

describe("postOutputSchema", () => {
  it("accepts a good answer and fills missing optional fields", () => {
    const out = postOutputSchema.parse({ body: "Hello there", hashtags: ["#Tips", "tips", " small business "] });
    expect(out.hook).toBe("");
    expect(out.cta).toBe("");
    expect(out.hashtags).toEqual(["Tips", "smallbusiness"]);
    expect(out.fact_check_flags).toEqual([]);
  });

  it("tolerates nulls from the model", () => {
    const out = postOutputSchema.parse({ hook: null, body: "x", cta: null, hashtags: null, image_brief: null, fact_check_flags: null });
    expect(out.hashtags).toEqual([]);
  });

  it("rejects an empty or oversized body", () => {
    expect(postOutputSchema.safeParse({ body: "  " }).success).toBe(false);
    expect(postOutputSchema.safeParse({ body: "x".repeat(9001) }).success).toBe(false);
  });
});

describe("cleanHashtags", () => {
  it("strips #, removes duplicates and overlong tags, and caps the count", () => {
    expect(cleanHashtags(["#a", "A", "b".repeat(41)])).toEqual(["a"]);
    expect(cleanHashtags(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(10);
  });
});

describe("extractJsonObject", () => {
  it("handles code fences and surrounding words", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJsonObject('Here you go: {"a":2} Thanks!')).toEqual({ a: 2 });
  });

  it("throws when there is no object", () => {
    expect(() => extractJsonObject("no json here")).toThrow();
  });
});

describe("checkLanguage", () => {
  it("accepts matching language and rejects mismatches", () => {
    expect(checkLanguage("A simple English sentence.", "en")).toBeNull();
    expect(checkLanguage(BN_SENTENCE, "bn")).toBeNull();
    expect(checkLanguage("A simple English sentence.", "bn")).not.toBeNull();
    expect(checkLanguage(BN_SENTENCE, "en")).not.toBeNull();
    expect(checkLanguage("12345 !!!", "en")).not.toBeNull();
  });
});
