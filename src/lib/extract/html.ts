export type ExtractedPage = {
  title: string | null;
  description: string | null;
  siteName: string | null;
  canonicalUrl: string | null;
  language: string | null;
  text: string;
  wordCount: number;
  /** True when the page text mentions subscribing or signing in to continue. */
  paywallSignal: boolean;
};

const MAX_HTML = 1_600_000;
const MAX_TEXT = 30_000;
const MAX_TAG = 4000;

const SKIP_CONTAINERS = new Set([
  "nav", "header", "footer", "aside", "form", "noscript", "svg", "template", "iframe", "select", "button", "dialog", "menu", "figure",
]);
const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "source", "area", "base", "col", "embed", "param", "track", "wbr"]);
const BLOCK_TAGS = new Set([
  "p", "div", "section", "article", "main", "li", "ul", "ol", "tr", "table", "blockquote", "pre", "br", "hr", "dl", "dt", "dd", "figcaption", "h1", "h2", "h3", "h4", "h5", "h6",
]);
const HEADING_TAGS = new Set(["h1", "h2", "h3"]);

const PAYWALL_PATTERN =
  /(subscribe to (continue|read|unlock)|subscribers? only|sign in to (read|continue)|log ?in to (read|continue)|create (a )?(free )?account to (read|continue)|already a subscriber|to continue reading|this (article|content) is (only )?for (paid )?(subscribers|members))/i;

const BOILERPLATE = /^(advertisement|share|share this|subscribe|sign up|read more|related( articles?)?|cookies?|accept( all)?|follow us|newsletter|menu|search)\b/i;

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", copy: "©", reg: "®", trade: "™", laquo: "«", raquo: "»", bull: "•", middot: "·",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", aacute: "á", agrave: "à", acirc: "â", auml: "ä", aring: "å", atilde: "ã",
  iacute: "í", igrave: "ì", icirc: "î", iuml: "ï", oacute: "ó", ograve: "ò", ocirc: "ô", ouml: "ö", otilde: "õ",
  uacute: "ú", ugrave: "ù", ucirc: "û", uuml: "ü", ntilde: "ñ", ccedil: "ç", szlig: "ß", yacute: "ý",
  Eacute: "É", Agrave: "À", Aacute: "Á", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", Ntilde: "Ñ", Ccedil: "Ç",
  euro: "€", pound: "£", yen: "¥", cent: "¢", sect: "§", deg: "°", plusmn: "±", times: "×", divide: "÷", frac12: "½",
  sbquo: "‚", bdquo: "„", prime: "′", larr: "←", rarr: "→",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,10});/gi, (match, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 32 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return " ";
      return String.fromCodePoint(code);
    }
    return ENTITIES[body] ?? ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Lowercases ASCII only, so string positions stay identical to the original. */
function asciiLower(text: string): string {
  return text.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
}

function getAttr(attrs: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(attrs);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value === undefined ? null : decodeEntities(value).trim();
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function safeHttpUrl(value: string | null | undefined, base: URL): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    const href = url.href;
    return href.length <= 2000 ? href : null;
  } catch {
    return null;
  }
}

type Paragraph = { text: string; heading: boolean; inArticle: boolean };

/**
 * Pulls the readable article text and basic details out of an HTML page without running any
 * scripts. One linear pass; it never builds a DOM and tolerates broken markup.
 */
export function extractReadable(html: string, baseUrl: URL): ExtractedPage {
  const src = html.length > MAX_HTML ? html.slice(0, MAX_HTML) : html;
  const lower = asciiLower(src);

  const metas: Record<string, string> = {};
  let titleTag: string | null = null;
  let canonicalHref: string | null = null;
  let language: string | null = null;

  const paragraphs: Paragraph[] = [];
  let current = "";
  let currentHeading = false;
  let articleDepth = 0;
  let skip: { name: string; depth: number } | null = null;
  let signalText = "";

  const flush = () => {
    const text = collapse(current);
    if (text) paragraphs.push({ text, heading: currentHeading, inArticle: articleDepth > 0 });
    current = "";
    currentHeading = false;
  };

  let i = 0;
  const n = src.length;

  // The next ">" is cached, so hostile input such as thousands of "<a " cannot make us rescan the
  // same text again and again. Parsing stays linear.
  let gtCache = -2;
  const nextGt = (from: number): number => {
    if (gtCache === -1 || gtCache >= from) return gtCache;
    gtCache = src.indexOf(">", from);
    return gtCache;
  };

  while (i < n) {
    const lt = src.indexOf("<", i);
    const chunkEnd = lt === -1 ? n : lt;
    if (chunkEnd > i) {
      const text = decodeEntities(src.slice(i, chunkEnd));
      if (signalText.length < 20_000) signalText += ` ${text}`;
      if (!skip) current += ` ${text}`;
    }
    if (lt === -1) break;

    if (lower.startsWith("<!--", lt)) {
      const end = lower.indexOf("-->", lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (src[lt + 1] === "!" || src[lt + 1] === "?") {
      const end = src.indexOf(">", lt + 1);
      i = end === -1 ? n : end + 1;
      continue;
    }

    const closing = src[lt + 1] === "/";
    const nameStart = lt + (closing ? 2 : 1);
    const nameMatch = /^[a-z][a-z0-9-]*/.exec(lower.slice(nameStart, nameStart + 32));
    if (!nameMatch) {
      current += skip ? "" : " <";
      i = lt + 1;
      continue;
    }
    const name = nameMatch[0];
    const gt = nextGt(nameStart + name.length);
    if (gt === -1) {
      // No tag can end anywhere after this point, so the rest is plain text.
      if (!skip) current += ` ${decodeEntities(src.slice(lt))}`;
      break;
    }
    if (gt - nameStart > MAX_TAG) {
      i = lt + 1;
      continue;
    }
    const attrs = src.slice(nameStart + name.length, gt);
    i = gt + 1;

    if (!closing && (name === "script" || name === "style")) {
      const end = lower.indexOf(`</${name}`, i);
      if (end === -1) {
        i = n;
      } else {
        const close = src.indexOf(">", end);
        i = close === -1 ? n : close + 1;
      }
      continue;
    }

    if (!closing && name === "title" && titleTag === null) {
      const end = lower.indexOf("</title", i);
      const stop = end === -1 ? Math.min(n, i + 500) : end;
      titleTag = collapse(decodeEntities(src.slice(i, stop)));
      i = end === -1 ? stop : (src.indexOf(">", end) === -1 ? n : src.indexOf(">", end) + 1);
      continue;
    }

    if (!closing) {
      if (name === "html") language = getAttr(attrs, "lang");
      if (name === "meta") {
        const key = (getAttr(attrs, "property") ?? getAttr(attrs, "name") ?? "").toLowerCase();
        const content = getAttr(attrs, "content");
        if (key && content && !(key in metas)) metas[key] = content;
      }
      if (name === "link" && canonicalHref === null && /\bcanonical\b/i.test(getAttr(attrs, "rel") ?? "")) {
        canonicalHref = getAttr(attrs, "href");
      }
    }

    if (skip) {
      if (name === skip.name && !VOID_TAGS.has(name)) {
        skip.depth += closing ? -1 : 1;
        if (skip.depth <= 0) skip = null;
      }
      continue;
    }

    if (!closing && SKIP_CONTAINERS.has(name) && !VOID_TAGS.has(name)) {
      flush();
      skip = { name, depth: 1 };
      continue;
    }

    if (BLOCK_TAGS.has(name)) flush();
    if (HEADING_TAGS.has(name) && !closing) currentHeading = true;
    if (name === "article" || name === "main") articleDepth = Math.max(0, articleDepth + (closing ? -1 : 1));
  }
  flush();

  // Keep meaningful paragraphs; drop short fragments, boilerplate, and repeats.
  const kept: Paragraph[] = [];
  let previous = "";
  for (const p of paragraphs) {
    const meaningful = p.heading ? p.text.length >= 3 : p.text.length >= 40 || (p.text.length >= 20 && /[.!?\u0964]$/.test(p.text));
    if (!meaningful || (p.text.length < 60 && BOILERPLATE.test(p.text)) || p.text === previous) continue;
    kept.push(p);
    previous = p.text;
  }

  const inArticle = kept.filter((p) => p.inArticle);
  const chosen = inArticle.reduce((sum, p) => sum + p.text.length, 0) >= 400 ? inArticle : kept;

  let text = "";
  for (const p of chosen) {
    const next = text ? `${text}\n\n${p.text}` : p.text;
    if (next.length > MAX_TEXT) break;
    text = next;
  }

  const title = (metas["og:title"] || titleTag || "").trim();
  const description = (metas["og:description"] || metas["description"] || "").trim();
  const siteName = (metas["og:site_name"] || "").trim();
  const canonical = safeHttpUrl(canonicalHref, baseUrl) ?? safeHttpUrl(metas["og:url"], baseUrl);
  const lang = (language ?? metas["og:locale"] ?? "").trim();

  return {
    title: title ? title.slice(0, 300) : null,
    description: description ? description.slice(0, 600) : null,
    siteName: siteName ? siteName.slice(0, 200) : null,
    canonicalUrl: canonical,
    language: lang ? lang.slice(0, 20) : null,
    text,
    wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
    paywallSignal: PAYWALL_PATTERN.test(signalText),
  };
}

export type ExtractionVerdict = "ok" | "paywall" | "too_little_text";

/** Decides whether the extracted text is a usable article. */
export function classifyExtraction(page: Pick<ExtractedPage, "wordCount" | "paywallSignal">): ExtractionVerdict {
  if (page.wordCount >= 120) return "ok";
  if (page.paywallSignal) return "paywall";
  if (page.wordCount < 60) return "too_little_text";
  return "ok";
}
