import { BENGALI } from "./site-pages";

/**
 * Blog helpers. Pure code (no database, no network), so every rule here is easy to test.
 * Articles are Markdown. A photo is written as  ![alt text](blog-image:<id>)  on its own line.
 */

export const BLOG_CATEGORIES = [
  { slug: "content-planning", name: "Content Planning", description: "How to plan, organize, and keep up a steady stream of Facebook Page content." },
  { slug: "writing-posts", name: "Writing Posts", description: "How to write Facebook posts that are clear, useful, and worth reading." },
  { slug: "scheduling-and-ai", name: "Scheduling and AI", description: "Scheduling tools, automation, and using AI to write posts without losing your voice." },
] as const;

export const MIN_ARTICLE_WORDS = 1250;
export const POSTS_PER_PAGE = 9;

const IMAGE_LINE = /^!\[([^\]]*)\]\(blog-image:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)\s*$/gm;
const PLACEHOLDER_LINE = /^\[\[image:\s*(.+?)\s*(?:\|\s*(.+?)\s*)?\]\]\s*$/gm;

// ---------- Counting ----------
/** Words a reader will read: Markdown marks, image lines, placeholders, and link addresses are not counted. */
export function countWords(markdown: string): number {
  const text = markdown
    .replace(IMAGE_LINE, " ")
    .replace(PLACEHOLDER_LINE, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[\s>*#-]+/gm, " ")
    .replace(/[*_`|]/g, " ");
  return (text.match(/[A-Za-z0-9\u00C0-\u024F]+(?:[’'-][A-Za-z0-9\u00C0-\u024F]+)*/g) ?? []).length;
}

export const readingMinutes = (words: number) => Math.max(1, Math.round(words / 220));

export function makeSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");
}

/** Words that would clash with the blog's own addresses (/blog/category/…). */
const RESERVED_SLUGS = ["category", "rss"];
export const isSlug = (v: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) && v.length >= 3 && v.length <= 90 && !RESERVED_SLUGS.includes(v);

// ---------- Images inside the text ----------
export function extractImageIds(body: string): string[] {
  return [...new Set([...body.matchAll(IMAGE_LINE)].map((m) => m[2] as string))];
}

export type Placeholder = { line: string; query: string; alt: string };

/** Lines like  [[image: coffee shop owner planning | A shop owner planning the week]]  that still wait for a photo. */
export function findPlaceholders(body: string): Placeholder[] {
  return [...body.matchAll(PLACEHOLDER_LINE)].map((m) => ({ line: m[0].trim(), query: (m[1] as string).trim(), alt: ((m[2] as string | undefined) ?? (m[1] as string)).trim() }));
}

export const imageLine = (alt: string, id: string) => `![${alt.replace(/[\[\]\n]/g, " ").replace(/\s+/g, " ").trim()}](blog-image:${id})`;

export function replaceFirstPlaceholder(body: string, line: string, replacement: string): string {
  const i = body.indexOf(line);
  return i < 0 ? body : body.slice(0, i) + replacement + body.slice(i + line.length);
}

export function replaceImageId(body: string, oldId: string, newId: string, newAlt: string | null): string {
  return body.replace(IMAGE_LINE, (whole, alt: string, id: string) => (id === oldId ? imageLine(newAlt ?? alt, newId) : whole));
}

export function publicImageUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/blog/${path.split("/").map(encodeURIComponent).join("/")}`;
}

// ---------- Cleaning ----------
export function cleanTags(raw: string): string[] {
  const tags = raw.split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, " ")).filter((t) => /^[a-z0-9][a-z0-9 -]{0,28}$/.test(t));
  return [...new Set(tags)].slice(0, 8);
}

export type PostInput = { title: string; slug: string; seoTitle: string; metaDescription: string; excerpt: string; body: string; categorySlug: string; focusKeyword: string; authorName: string };

/** The error to show, or null when the post may be saved (as a draft or published). */
export function validatePost(p: PostInput): string | null {
  if (p.title.trim().length < 5 || p.title.length > 140) return "The title must be 5 to 140 characters.";
  if (!isSlug(p.slug)) return "The address (slug) can use lowercase letters, numbers and single dashes, 3 to 90 characters.";
  if (p.seoTitle.length > 70) return "The search title can be at most 70 characters.";
  if (p.metaDescription.length > 200) return "The search description can be at most 200 characters.";
  if (p.excerpt.length > 320) return "The short summary can be at most 320 characters.";
  if (p.focusKeyword.length > 80) return "The focus keyword can be at most 80 characters.";
  if (p.authorName.trim().length < 2 || p.authorName.length > 80) return "The author name must be 2 to 80 characters.";
  if (p.body.length > 150000) return "The article is too long.";
  if (BENGALI.test(`${p.title}${p.seoTitle}${p.metaDescription}${p.excerpt}${p.body}${p.focusKeyword}${p.authorName}`)) return "The blog is English only. Remove the Bengali characters.";
  return null;
}

/** Extra rules for putting an article live. */
export function validatePublish(p: PostInput & { hasFeaturedImage: boolean }): string | null {
  if (p.excerpt.trim().length < 50) return "Add a short summary (at least 50 characters) before publishing.";
  if (p.metaDescription.trim().length < 70) return "Add a search description (at least 70 characters) before publishing.";
  if (!p.categorySlug) return "Choose a category before publishing.";
  if (countWords(p.body) < 300) return "The article is too short to publish.";
  if (!p.hasFeaturedImage) return "Add a featured image before publishing.";
  return null;
}

// ---------- Contents list and related articles ----------
export function excerptFrom(body: string, max = 200): string {
  const first = body.split(/\n\s*\n/).map((b) => b.trim()).find((b) => b && !/^(#|!\[|\[\[|[-*>]|\d+\.)/.test(b)) ?? "";
  const plain = first.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "");
  return plain.length <= max ? plain : `${plain.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

export type RelatableMeta = { slug: string; categorySlug: string | null; tags: string[]; isPillar: boolean; publishedAt: string | null };

/** Higher is more related: same category counts most, shared tags add, the pillar of the same category is preferred. */
export function relatedScore(base: RelatableMeta, other: RelatableMeta): number {
  if (base.slug === other.slug) return -1;
  let score = 0;
  if (base.categorySlug && base.categorySlug === other.categorySlug) score += 10;
  score += other.tags.filter((t) => base.tags.includes(t)).length * 3;
  if (other.isPillar && base.categorySlug === other.categorySlug) score += 4;
  return score;
}

export function pickRelated<T extends RelatableMeta>(base: RelatableMeta, candidates: T[], count = 3): T[] {
  return candidates
    .map((c) => ({ c, s: relatedScore(base, c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (b.c.publishedAt ?? "").localeCompare(a.c.publishedAt ?? ""))
    .slice(0, count)
    .map((x) => x.c);
}

export function pageCount(total: number, perPage = POSTS_PER_PAGE) {
  return Math.max(1, Math.ceil(total / perPage));
}

// ---------- Checklist shown while editing ----------
export type CheckItem = { level: "ok" | "warn"; label: string; detail: string };

/** True when every word of the keyword appears in the text (so "plan facebook content" matches "Plan a Month of Facebook Page Content"). */
export function hasAllWords(text: string, keyword: string): boolean {
  const hay = text.toLowerCase();
  const words = keyword.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return words.length > 0 && words.every((w) => hay.includes(w));
}

export function internalLinkCount(body: string): number {
  return [...body.matchAll(/\]\((\/(?:blog|tools|pricing)[^)\s]*)\)/g)].length;
}

export function postChecklist(p: { title: string; slug: string; seoTitle: string; metaDescription: string; excerpt: string; body: string; focusKeyword: string; hasFeaturedImage: boolean }): CheckItem[] {
  const out: CheckItem[] = [];
  const add = (ok: boolean, label: string, detail: string) => out.push({ level: ok ? "ok" : "warn", label, detail });
  const words = countWords(p.body);
  add(words >= MIN_ARTICLE_WORDS, "Length", `${words.toLocaleString("en-US")} words. Aim for ${MIN_ARTICLE_WORDS.toLocaleString("en-US")} or more.`);
  const shownTitle = p.seoTitle || p.title;
  add(shownTitle.length >= 30 && shownTitle.length <= 60, "Search title", `${shownTitle.length} characters (about 30 to 60 is best).`);
  add(p.metaDescription.length >= 110 && p.metaDescription.length <= 160, "Search description", `${p.metaDescription.length} characters (about 110 to 160 is best).`);
  const h2 = (p.body.match(/^## /gm) ?? []).length;
  add(h2 >= 4, "Sections", `${h2} main headings. Four or more make the article easy to scan.`);
  const images = extractImageIds(p.body).length;
  add(images >= 3, "Pictures in the text", `${images} in the text. Three or four related pictures work well.`);
  add(p.hasFeaturedImage, "Featured image", p.hasFeaturedImage ? "Set." : "Add one. It is the article's picture in lists and when shared.");
  add(findPlaceholders(p.body).length === 0, "Image placeholders", findPlaceholders(p.body).length === 0 ? "None left." : `${findPlaceholders(p.body).length} still waiting for a photo. Use "Find the photos".`);
  const links = internalLinkCount(p.body);
  add(links >= 3, "Links to other pages", `${links} links to other articles, tools or pricing. Three or more help readers and search engines.`);
  const kw = p.focusKeyword.trim().toLowerCase();
  if (kw) {
    const firstPara = p.body.split(/\n\s*\n/).find((b) => b.trim() && !b.startsWith("#") && !b.startsWith("!")) ?? "";
    const inTitle = hasAllWords(p.title, kw);
    const inSlug = hasAllWords(p.slug.replace(/-/g, " "), kw);
    const inFirst = hasAllWords(firstPara, kw);
    add(inTitle, "Keyword in the title", inTitle ? "Yes." : `The title does not contain all the words of "${p.focusKeyword}".`);
    add(inSlug, "Keyword in the address", inSlug ? "Yes." : "The address does not contain the keyword words.");
    add(inFirst, "Keyword in the first paragraph", inFirst ? "Yes." : "Mention it in the first paragraph.");
  } else {
    add(false, "Focus keyword", "Add the main phrase this article should rank for.");
  }
  const sentences = p.body.replace(IMAGE_LINE, " ").split(/[.!?]+\s/).filter((s) => s.trim().length > 0);
  const avg = sentences.length > 0 ? words / sentences.length : 0;
  add(avg > 0 && avg <= 22, "Sentence length", `${avg.toFixed(1)} words per sentence on average. Shorter sentences read easier.`);
  add(p.excerpt.length >= 50, "Short summary", `${p.excerpt.length} characters. It appears on the cards.`);
  return out;
}
