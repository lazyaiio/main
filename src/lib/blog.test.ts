import { describe, expect, it } from "vitest";
import { countWords, excerptFrom, extractImageIds, findPlaceholders, imageLine, internalLinkCount, isSlug, makeSlug, pageCount, pickRelated, postChecklist, publicImageUrl, readingMinutes, replaceFirstPlaceholder, replaceImageId, validatePost, validatePublish, cleanTags } from "./blog";
import { parseMarkdown } from "./markdown";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

describe("counting", () => {
  it("counts reader words only", () => {
    const md = `## Heading here\n\nOne two three [four five](/blog/x).\n\n![alt text](blog-image:${ID1})\n\n[[image: query words | alt words]]\n\n- six\n- seven`;
    expect(countWords(md)).toBe(9); // Heading here + One two three four five + six seven
  });
  it("keeps contractions and hyphenated words as one word", () => {
    expect(countWords("Don’t over-think it.")).toBe(3);
  });
  it("estimates reading time", () => {
    expect(readingMinutes(1320)).toBe(6);
    expect(readingMinutes(10)).toBe(1);
  });
});

describe("slugs", () => {
  it("makes clean slugs", () => {
    expect(makeSlug("How Often Should You Post on a Facebook Page?")).toBe("how-often-should-you-post-on-a-facebook-page");
    expect(makeSlug("Don’t Panic: 30 Ideas!")).toBe("dont-panic-30-ideas");
  });
  it("validates slugs", () => {
    expect(isSlug("a-b-c")).toBe(true);
    for (const bad of ["ab", "-a-b", "a--b", "A-b-c", "a b c"]) expect(isSlug(bad)).toBe(false);
  });
});

describe("images in the text", () => {
  const body = `Intro\n\n${imageLine("First [pic]", ID1)}\n\nMore\n\n${imageLine("Second", ID2)}\n\n[[image: coffee shop | A coffee shop]]`;
  it("finds image ids and placeholders", () => {
    expect(extractImageIds(body)).toEqual([ID1, ID2]);
    expect(findPlaceholders(body)).toEqual([{ line: "[[image: coffee shop | A coffee shop]]", query: "coffee shop", alt: "A coffee shop" }]);
  });
  it("cleans brackets out of the alt text", () => {
    expect(imageLine("a [b] c", ID1)).toBe(`![a b c](blog-image:${ID1})`);
  });
  it("replaces one placeholder with a photo", () => {
    const next = replaceFirstPlaceholder(body, "[[image: coffee shop | A coffee shop]]", imageLine("A coffee shop", ID1));
    expect(findPlaceholders(next)).toHaveLength(0);
  });
  it("swaps one image for another", () => {
    const next = replaceImageId(body, ID1, ID2, "New alt");
    expect(next).toContain(`![New alt](blog-image:${ID2})`);
    expect(next).not.toContain(ID1);
  });
  it("builds public photo addresses", () => {
    expect(publicImageUrl("https://x.supabase.co/", "a/b c.webp")).toBe("https://x.supabase.co/storage/v1/object/public/blog/a/b%20c.webp");
  });
});

describe("markdown for articles", () => {
  it("reads photos and quotes, and hides placeholders", () => {
    const blocks = parseMarkdown(`## Title\n\n![alt](blog-image:${ID1})\n\n[[image: waiting | waiting]]\n\n> Tip: be brief.\n> Really.\n\nText`);
    expect(blocks.map((b) => b.type)).toEqual(["h2", "image", "quote", "p"]);
  });
  it("does not accept photos from other addresses", () => {
    expect(parseMarkdown("![x](https://evil.example/a.png)").some((b) => b.type === "image")).toBe(false);
  });
});

describe("validation", () => {
  const ok = { title: "How to plan a month of Facebook content", slug: "plan-a-month-of-facebook-content", seoTitle: "", metaDescription: "", excerpt: "", body: "Body text.", categorySlug: "content-planning", focusKeyword: "", authorName: "LazyAI Team" };
  it("accepts a normal post", () => {
    expect(validatePost(ok)).toBeNull();
  });
  it("refuses bad slugs, long fields and Bengali text", () => {
    expect(validatePost({ ...ok, slug: "Bad Slug" })).not.toBeNull();
    expect(validatePost({ ...ok, seoTitle: "x".repeat(80) })).not.toBeNull();
    expect(validatePost({ ...ok, body: "text \u0995\u0996" })).toContain("English");
  });
  it("needs the basics to publish", () => {
    const words = "word ".repeat(400);
    const full = { ...ok, excerpt: "e".repeat(60), metaDescription: "m".repeat(100), body: words, hasFeaturedImage: true };
    expect(validatePublish(full)).toBeNull();
    expect(validatePublish({ ...full, hasFeaturedImage: false })).toContain("featured image");
    expect(validatePublish({ ...full, excerpt: "short" })).toContain("summary");
    expect(validatePublish({ ...full, categorySlug: "" })).toContain("category");
  });
  it("cleans tags", () => {
    expect(cleanTags("Facebook Pages, social media, , facebook pages, <b>")).toEqual(["facebook pages", "social media"]);
  });
});

describe("related articles", () => {
  const base = { slug: "a", categorySlug: "c1", tags: ["x", "y"], isPillar: false, publishedAt: "2026-01-01" };
  const make = (slug: string, categorySlug: string, tags: string[], isPillar = false, publishedAt = "2026-01-01") => ({ slug, categorySlug, tags, isPillar, publishedAt });
  it("prefers the same category and shared tags, never the article itself", () => {
    const picks = pickRelated(base, [make("a", "c1", ["x"]), make("b", "c2", ["x", "y"]), make("c", "c1", []), make("d", "c3", []), make("e", "c1", ["x"], true)], 3);
    expect(picks.map((p) => p.slug)).toEqual(["e", "c", "b"]);
  });
  it("pages", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(19)).toBe(3);
  });
});

describe("checklist and text helpers", () => {
  it("counts links to other pages", () => {
    expect(internalLinkCount("[a](/blog/x) [b](/tools/y) [c](https://x.com) [d](/pricing)")).toBe(3);
  });
  it("takes a plain excerpt from the first paragraph", () => {
    expect(excerptFrom("## H\n\nThis is **the** first [paragraph](/x).\n\nSecond.")).toBe("This is the first paragraph.");
  });
  it("flags what is missing", () => {
    const items = postChecklist({ title: "T", slug: "t", seoTitle: "", metaDescription: "", excerpt: "", body: "short", focusKeyword: "", hasFeaturedImage: false });
    const warned = items.filter((i) => i.level === "warn").map((i) => i.label);
    for (const label of ["Length", "Search title", "Search description", "Sections", "Featured image", "Links to other pages", "Focus keyword", "Short summary"]) expect(warned).toContain(label);
  });
  it("is happy with a complete article", () => {
    const body = ["## One", "## Two", "## Three", "## Four"].map((h) => `${h}\n\n${"Short clear sentence about plans. ".repeat(120)}`).join("\n\n") + `\n\n![a](blog-image:${ID1})\n\n![b](blog-image:${ID2})\n\n![c](blog-image:33333333-3333-4333-8333-333333333333)\n\n[a](/blog/x) [b](/tools/y) [c](/pricing)`;
    const first = `Facebook content planning works.\n\n${body}`;
    const items = postChecklist({ title: "Facebook content planning that works", slug: "facebook-content-planning", seoTitle: "", metaDescription: "m".repeat(130), excerpt: "e".repeat(80), body: first, focusKeyword: "facebook content planning", hasFeaturedImage: true });
    expect(items.filter((i) => i.level === "warn").map((i) => i.label)).toEqual([]);
  });
});
