import { describe, expect, it } from "vitest";
import { DIAGRAM_NAMES } from "@/components/docs/diagrams";
import { SEO_PAGES } from "@/lib/seo";
import { parseMarkdown, type Block, type Inline } from "@/lib/markdown";
import { DOCS, DOC_GROUPS, DOC_SLUGS } from "./docs";
import { SEED_ARTICLES } from "./blog-seed";
import { SCREENSHOT_NAMES } from "./screenshots";

const PAGES = new Set(SEO_PAGES.map((p) => p.path));
const BLOG = new Set(SEED_ARTICLES.map((a) => `/blog/${a.slug}`));
const DOCS_PATHS = new Set(DOC_SLUGS.map((s) => `/docs/${s}`));

function links(nodes: Inline[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.type === "link") {
      out.push(n.href);
      links(n.children, out);
    } else if (n.type === "strong" || n.type === "em") links(n.children, out);
  }
  return out;
}
function blockLinks(blocks: Block[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === "p" || b.type === "quote" || b.type === "h2" || b.type === "h3") links(b.children, out);
    else if (b.type === "ul" || b.type === "ol") b.items.forEach((i) => links(i, out));
    else if (b.type === "table") for (const cell of [...b.header, ...b.rows.flat()]) links(cell, out);
  }
  return out;
}

describe("docs", () => {
  it("has unique slugs, valid groups and search-friendly descriptions", () => {
    expect(new Set(DOC_SLUGS).size).toBe(DOCS.length);
    for (const d of DOCS) {
      expect(DOC_GROUPS as readonly string[], d.slug).toContain(d.group);
      expect(d.description.length, d.slug).toBeGreaterThanOrEqual(60);
      expect(d.description.length, d.slug).toBeLessThanOrEqual(170);
      expect(d.title.length, d.slug).toBeLessThanOrEqual(70);
      expect(d.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.slug).toMatch(/^[a-z0-9-]{3,60}$/);
    }
  });
  it("is written in English with no Bengali characters", () => {
    expect(JSON.stringify(DOCS)).not.toMatch(/[\u0980-\u09FF]/);
  });
  it("has enough in each guide, with a clear structure", () => {
    for (const d of DOCS) {
      const blocks = parseMarkdown(d.body);
      expect(d.body.split(/\s+/).length, d.slug).toBeGreaterThan(120);
      expect(blocks.filter((b) => b.type === "h2").length, d.slug).toBeGreaterThanOrEqual(2);
      expect(blocks.some((b) => b.type === "h1" as never), d.slug).toBe(false);
    }
  });
  it("only links to pages that exist", () => {
    const known = new Set([...PAGES, ...BLOG, ...DOCS_PATHS, "/help", "/pricing", "/contact", "/privacy", "/terms", "/cookies", "/data-deletion"]);
    for (const d of DOCS) {
      for (const href of blockLinks(parseMarkdown(d.body))) {
        if (href.startsWith("/")) expect(known.has(href.split("#")[0] as string), `${d.slug} -> ${href}`).toBe(true);
      }
    }
  });
  it("uses only diagrams that exist and screenshots with a description", () => {
    for (const d of DOCS) {
      for (const b of parseMarkdown(d.body)) {
        if (b.type === "diagram") expect(DIAGRAM_NAMES, `${d.slug}: ${b.name}`).toContain(b.name);
        if (b.type === "screenshot") expect(b.alt.length, `${d.slug}: ${b.name}`).toBeGreaterThan(10);
      }
    }
    expect(new Set(SCREENSHOT_NAMES).size).toBe(SCREENSHOT_NAMES.length);
  });
  it("turns every table into a real table with the same number of cells in each row", () => {
    for (const d of DOCS) {
      for (const b of parseMarkdown(d.body)) {
        if (b.type === "table") for (const row of b.rows) expect(row.length, d.slug).toBe(b.header.length);
      }
      const rawTables = d.body.split("\n").filter((l) => l.trim().startsWith("|")).length;
      const parsedRows = parseMarkdown(d.body).reduce((n, b) => (b.type === "table" ? n + b.rows.length + 2 : n), 0);
      expect(parsedRows, `${d.slug}: a table was not recognized`).toBe(rawTables);
    }
  });
  it("matches what the app really offers (menu names, statuses, limits)", () => {
    const all = DOCS.map((d) => d.body).join("\n");
    for (const word of ["Scheduled", "Publishing", "Retrying", "Published", "Failed", "Canceled"]) expect(all).toContain(word);
    expect(all).toContain("4 MB");
    expect(all).toContain("8,000");
    expect(all).toContain("pages_manage_posts");
  });
});

describe("blog articles use the new figures safely", () => {
  it("only uses diagrams that exist", () => {
    for (const a of SEED_ARTICLES) for (const b of parseMarkdown(a.body)) if (b.type === "diagram") expect(DIAGRAM_NAMES).toContain(b.name);
  });
});
