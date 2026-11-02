import { describe, expect, it } from "vitest";
import { BLOG_CATEGORIES, MIN_ARTICLE_WORDS, countWords, extractImageIds, findPlaceholders, isSlug, postChecklist, validatePost } from "@/lib/blog";
import { parseMarkdown } from "@/lib/markdown";
import { SEED_ARTICLES } from "./blog-seed";

const slugs = SEED_ARTICLES.map((a) => a.slug);
const TOOLS = ["/tools/post-idea-generator", "/tools/content-calendar-generator", "/tools/post-checker"];

describe("starter articles", () => {
  it("are valid posts with unique addresses and known categories", () => {
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const a of SEED_ARTICLES) {
      expect(isSlug(a.slug)).toBe(true);
      expect(BLOG_CATEGORIES.some((c) => c.slug === a.category)).toBe(true);
      expect(validatePost({ title: a.title, slug: a.slug, seoTitle: a.seoTitle, metaDescription: a.metaDescription, excerpt: a.excerpt, body: a.body, categorySlug: a.category, focusKeyword: a.focusKeyword, authorName: "LazyAI Team" })).toBeNull();
    }
  });

  it("each have at least 1,250 words, four photo spots, and a clean SEO checklist except the photos still to be found", () => {
    for (const a of SEED_ARTICLES) {
      expect(countWords(a.body)).toBeGreaterThanOrEqual(MIN_ARTICLE_WORDS);
      expect(findPlaceholders(a.body).length).toBeGreaterThanOrEqual(4);
      const warned = postChecklist({ title: a.title, slug: a.slug, seoTitle: a.seoTitle, metaDescription: a.metaDescription, excerpt: a.excerpt, body: a.body, focusKeyword: a.focusKeyword, hasFeaturedImage: true }).filter((i) => i.level === "warn").map((i) => i.label);
      // Photos are added later by the "Find the photos" button.
      expect(warned.filter((l) => l !== "Pictures in the text" && l !== "Image placeholders")).toEqual([]);
    }
  });

  it("have one pillar per category, and every category has at least two articles", () => {
    for (const c of BLOG_CATEGORIES) {
      const inCat = SEED_ARTICLES.filter((a) => a.category === c.slug);
      expect(inCat.filter((a) => a.isPillar)).toHaveLength(1);
      expect(inCat.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("only link to pages that exist, and every article is linked from another one", () => {
    const linked = new Set<string>();
    for (const a of SEED_ARTICLES) {
      for (const m of a.body.matchAll(/\]\((\/[^)\s]*)\)/g)) {
        const href = m[1] as string;
        if (href.startsWith("/blog/")) {
          expect(slugs).toContain(href.slice(6));
          expect(href.slice(6)).not.toBe(a.slug);
          linked.add(href.slice(6));
        } else {
          expect([...TOOLS, "/pricing"]).toContain(href);
        }
      }
    }
    for (const s of slugs) expect([...linked]).toContain(s);
  });

  it("link to every pillar's supporting articles, and every supporting article links up to its pillar", () => {
    for (const c of BLOG_CATEGORIES) {
      const pillar = SEED_ARTICLES.find((a) => a.category === c.slug && a.isPillar)!;
      for (const a of SEED_ARTICLES.filter((x) => x.category === c.slug && !x.isPillar)) {
        expect(a.body).toContain(`](/blog/${pillar.slug})`);
      }
    }
  });

  it("use only the supported Markdown, and no raw images or HTML", () => {
    for (const a of SEED_ARTICLES) {
      expect(/<\/?[a-zA-Z]/.test(a.body)).toBe(false);
      expect(extractImageIds(a.body)).toHaveLength(0);
      expect(parseMarkdown(a.body).some((b) => b.type === "image")).toBe(false);
      expect(parseMarkdown(a.body).filter((b) => b.type === "h2").length).toBeGreaterThanOrEqual(4);
    }
  });
});
