import { describe, expect, it } from "vitest";
import { classifyExtraction, decodeEntities, extractReadable } from "./html";

const BASE = new URL("https://news.example.com/2026/10/story?utm=1");

const LONG = (seed: string) =>
  `${seed} `.repeat(3) +
  "Local shop owners are finding that a steady posting routine matters more than any single viral post, because customers notice who shows up every week and who disappears for a month at a time.";

const ARTICLE = `<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta charset="utf-8">
  <title>Fallback title | Example News</title>
  <meta property="og:title" content="How shops win on social media">
  <meta property="og:site_name" content="Example News">
  <meta name="description" content="A short summary.">
  <link rel="canonical" href="/2026/10/story">
  <script>var secret = "SCRIPT_TEXT_SHOULD_NOT_APPEAR";</script>
  <style>.x{color:red}</style>
</head>
<body>
  <header><h1>SITE HEADER NAV</h1><nav><a href="/">Home</a></nav></header>
  <aside>Advertisement block that should be dropped from the article text entirely.</aside>
  <article>
    <h1>How shops win on social media</h1>
    <p>${LONG("First")}</p>
    <p>Fish &amp; chips, caf&eacute; owners &#8212; and &#x2019;quoted&#x2019; words are decoded correctly in the output text.</p>
    <p>${LONG("Second")}</p>
    <!-- a comment that must not appear -->
    <p>${LONG("Third")}</p>
  </article>
  <footer>Copyright footer text that is long enough to otherwise look like a real paragraph here.</footer>
</body></html>`;

describe("extractReadable", () => {
  const page = extractReadable(ARTICLE, BASE);

  it("finds the title, site, description, language, and canonical address", () => {
    expect(page.title).toBe("How shops win on social media");
    expect(page.siteName).toBe("Example News");
    expect(page.description).toBe("A short summary.");
    expect(page.language).toBe("en-US");
    expect(page.canonicalUrl).toBe("https://news.example.com/2026/10/story");
  });

  it("keeps article paragraphs and drops scripts, styles, nav, headers, footers, and comments", () => {
    expect(page.text).toContain("First First First");
    expect(page.text).toContain("Second Second");
    expect(page.text).not.toContain("SCRIPT_TEXT_SHOULD_NOT_APPEAR");
    expect(page.text).not.toContain("SITE HEADER NAV");
    expect(page.text).not.toContain("Advertisement block");
    expect(page.text).not.toContain("Copyright footer");
    expect(page.text).not.toContain("a comment that must not appear");
  });

  it("decodes entities", () => {
    expect(page.text).toContain("Fish & chips, caf\u00e9 owners \u2014 and \u2019quoted\u2019 words");
  });

  it("counts words and passes the quality check", () => {
    expect(page.wordCount).toBeGreaterThan(100);
    expect(classifyExtraction(page)).toBe("ok");
  });
});

describe("page problems", () => {
  it("flags subscriber-only pages", () => {
    const html = `<html><body><article><h1>Big story</h1><p>The first two sentences are visible to everyone who visits this page today.</p>
      <div class="wall">Subscribe to continue reading this article. Already a subscriber? Sign in.</div></article></body></html>`;
    const result = extractReadable(html, BASE);
    expect(result.paywallSignal).toBe(true);
    expect(classifyExtraction(result)).toBe("paywall");
  });

  it("flags pages with almost no text (for example JavaScript-only apps)", () => {
    const html = `<html><head><title>App</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
    const result = extractReadable(html, BASE);
    expect(classifyExtraction(result)).toBe("too_little_text");
  });

  it("does not call a long article a paywall just because it mentions subscribing", () => {
    const html = `<html><body><article><p>${LONG("Alpha")}</p><p>${LONG("Bravo")}</p><p>${LONG("Charlie")}</p><p>Readers can subscribe to continue reading our weekly newsletter.</p></article></body></html>`;
    expect(classifyExtraction(extractReadable(html, BASE))).toBe("ok");
  });
});

describe("robustness", () => {
  it("survives broken markup", () => {
    const html = `<html><body><div><p>${LONG("Broken")}<div <p>unclosed <b>bold<article>${LONG("Tail")}`;
    const result = extractReadable(html, BASE);
    expect(result.text).toContain("Broken");
  });

  it("rejects non-web canonical addresses", () => {
    const html = `<html><head><link rel="canonical" href="javascript:alert(1)"></head><body><p>${LONG("X")}</p></body></html>`;
    expect(extractReadable(html, BASE).canonicalUrl).toBeNull();
  });

  it("handles hostile input in linear time", () => {
    const started = Date.now();
    extractReadable("<a ".repeat(300_000), BASE);
    extractReadable("<p>".repeat(200_000) + "text", BASE);
    extractReadable("<script>".repeat(100_000), BASE);
    extractReadable(`<meta ${"a=\"".repeat(100_000)}`, BASE);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("caps the extracted text length", () => {
    const html = `<html><body>${`<p>${"word ".repeat(400)}</p>`.repeat(100)}</body></html>`;
    expect(extractReadable(html, BASE).text.length).toBeLessThan(30001);
  });
});

describe("decodeEntities", () => {
  it("handles named, decimal, hex, unknown, and invalid entities", () => {
    expect(decodeEntities("&lt;b&gt; &amp;amp; &#65;&#x42; &unknown; &#0; &#xD800;")).toBe("<b> &amp; AB &unknown;    ");
  });
});
