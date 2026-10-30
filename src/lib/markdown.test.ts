import { describe, expect, it } from "vitest";
import { applyTokens, escapeMarkdown, isSafeHref, parseInline, parseMarkdown, slugify, tableOfContents } from "./markdown";

describe("parseMarkdown blocks", () => {
  it("reads headings, paragraphs and lists", () => {
    const blocks = parseMarkdown("## First part\n\nHello world.\nSecond line.\n\n- one\n- two\n  wrapped\n\n1. a\n2. b\n\n### Small");
    expect(blocks.map((b) => b.type)).toEqual(["h2", "p", "ul", "ol", "h3"]);
    const ul = blocks[2];
    expect(ul?.type === "ul" && ul.items.length).toBe(2);
    expect(JSON.stringify(blocks[1])).toContain("Hello world. Second line.");
  });

  it("gives headings an id, or uses the custom one", () => {
    const [a, b] = parseMarkdown("## Getting started\n\n## Scheduling your posts {#approve}");
    expect(a?.type === "h2" && a.id).toBe("getting-started");
    expect(b?.type === "h2" && b.id).toBe("approve");
  });

  it("recognizes the deletion form marker only on its own line", () => {
    expect(parseMarkdown("{{deletion_check_form}}")[0]).toEqual({ type: "form", name: "deletion_check_form" });
    expect(parseMarkdown("text {{deletion_check_form}} text")[0]?.type).toBe("p");
  });

  it("builds a table of contents from second-level headings", () => {
    expect(tableOfContents(parseMarkdown("## A\n\n### skip\n\n## B {#bee}"))).toEqual([{ id: "a", label: "A" }, { id: "bee", label: "B" }]);
  });
});

describe("parseInline", () => {
  it("reads bold, italic, code and links", () => {
    const nodes = parseInline("a **b** *c* `d` [e](/f)");
    expect(nodes.map((n) => n.type)).toEqual(["text", "strong", "text", "em", "text", "code", "text", "link"]);
  });

  it("keeps the words but drops unsafe links", () => {
    const nodes = parseInline("[click](javascript:alert(1))");
    expect(nodes.some((n) => n.type === "link")).toBe(false);
    expect(JSON.stringify(nodes)).toContain("click");
  });

  it("treats raw HTML as plain text", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([{ type: "text", text: "<script>alert(1)</script>" }]);
  });

  it("honors a backslash escape", () => {
    expect(parseInline("2 \\* 3 \\* 4")).toEqual([{ type: "text", text: "2 * 3 * 4" }]);
  });
});

describe("links and tokens", () => {
  it("allows only safe addresses", () => {
    for (const ok of ["/privacy", "#top", "https://example.com/a?b=1", "mailto:hi@example.com"]) expect(isSafeHref(ok)).toBe(true);
    for (const bad of ["//evil.com", "javascript:alert(1)", "data:text/html,x", "ftp://x.com", "mailto:nope"]) expect(isSafeHref(bad)).toBe(false);
  });

  it("fills tokens and drops unknown ones", () => {
    expect(applyTokens("By {{operator}}{{nothing}}.", { operator: "Acme" })).toBe("By Acme.");
    expect(applyTokens("{{deletion_check_form}}", {})).toBe("{{deletion_check_form}}");
  });

  it("escapes values so they cannot add formatting", () => {
    expect(parseInline(escapeMarkdown("A *B* [C](/x)"))).toEqual([{ type: "text", text: "A *B* [C](/x)" }]);
  });

  it("makes plain slugs", () => {
    expect(slugify("What each status means!")).toBe("what-each-status-means");
  });
});
