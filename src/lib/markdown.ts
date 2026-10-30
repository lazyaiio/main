/**
 * A small, safe Markdown reader for the pages an admin can edit. It understands only what the pages need:
 * ## and ### headings (with an optional {#id}), paragraphs, bullet and numbered lists, **bold**, *italic*,
 * `code`, and [links](address). Everything else is plain text. It produces a tree, never HTML, so nothing
 * typed in the editor can run as a script. Links are limited to https, http, mailto, and this site's own paths.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "h2" | "h3"; id: string; children: Inline[] }
  | { type: "p"; children: Inline[] }
  | { type: "ul" | "ol"; items: Inline[][] }
  | { type: "form"; name: "deletion_check_form" };

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Only these addresses become links. javascript:, data:, and protocol-relative addresses never do. */
export function isSafeHref(href: string): boolean {
  if (/^\/(?!\/)/.test(href)) return true;
  if (/^#[A-Za-z0-9_-]+$/.test(href)) return true;
  if (/^mailto:[^\s<>"]+@[^\s<>"]+$/i.test(href)) return true;
  return /^https?:\/\/[^\s<>"]+$/i.test(href);
}

/** Escapes the characters that Markdown treats as formatting, for values that are inserted as plain text. */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]()#{}])/g, "\\$1");
}

export type PageTokens = Record<string, string>;

/** Replaces {{name}} with a value. Unknown names disappear. Values are inserted as written (callers escape them). */
export function applyTokens(text: string, tokens: PageTokens): string {
  return text.replace(/\{\{([a-z_]{1,40})\}\}/g, (whole, name: string) => (name === "deletion_check_form" ? whole : (tokens[name] ?? "")));
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) out.push({ type: "text", text: buffer });
    buffer = "";
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch === "\\" && i + 1 < text.length) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }
    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ type: "code", text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (ch === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ type: "strong", children: parseInline(text.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (ch === "*") {
      const end = text.indexOf("*", i + 1);
      if (end > i + 1 && text[i + 1] !== " ") {
        flush();
        out.push({ type: "em", children: parseInline(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (ch === "[") {
      const close = text.indexOf("](", i + 1);
      const end = close === -1 ? -1 : text.indexOf(")", close + 2);
      if (close > i && end > close) {
        const label = text.slice(i + 1, close);
        const href = text.slice(close + 2, end).trim();
        if (isSafeHref(href)) {
          flush();
          out.push({ type: "link", href, children: parseInline(label) });
        } else {
          buffer += label; // an unsafe address: keep the words, drop the link
        }
        i = end + 1;
        continue;
      }
    }
    buffer += ch;
    i++;
  }
  flush();
  return out;
}

const HEADING = /^(#{2,3})\s+(.+?)\s*$/;
const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d{1,3}[.)]\s+(.*)$/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      const text = paragraph.join(" ").trim();
      if (text === "{{deletion_check_form}}") blocks.push({ type: "form", name: "deletion_check_form" });
      else if (text) blocks.push({ type: "p", children: parseInline(text) });
    }
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: list.type, items: list.items.map((item) => parseInline(item)) });
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = HEADING.exec(line.trim());
    if (heading) {
      flushParagraph();
      flushList();
      let text = heading[2] as string;
      let id = "";
      const custom = /\s*\{#([A-Za-z0-9_-]{1,60})\}$/.exec(text);
      if (custom) {
        id = custom[1] as string;
        text = text.slice(0, custom.index);
      }
      blocks.push({ type: heading[1] === "##" ? "h2" : "h3", id: id || slugify(text), children: parseInline(text) });
      continue;
    }
    const bullet = BULLET.exec(line.trim());
    const numbered = bullet ? null : NUMBERED.exec(line.trim());
    if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? "ul" : "ol";
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push(((bullet ?? numbered) as RegExpExecArray)[1] as string);
      continue;
    }
    if (list && /^\s+\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`; // a wrapped list item
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** The second-level headings, for a "on this page" list. */
export function tableOfContents(blocks: Block[]): { id: string; label: string }[] {
  const text = (nodes: Inline[]): string =>
    nodes.map((n) => (n.type === "text" || n.type === "code" ? n.text : text(n.children))).join("");
  return blocks.flatMap((b) => (b.type === "h2" ? [{ id: b.id, label: text(b.children) }] : []));
}
