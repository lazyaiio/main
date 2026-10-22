import { ExtractError } from "./errors";
import { classifyExtraction, extractReadable } from "./html";
import { assertRobotsAllow } from "./robots";
import { fetchPage, type FetchPageOptions } from "./safe-fetch";
import { parseUserUrl } from "./url-safety";

export type ArticleSource = {
  /** The address the user gave (normalized). */
  requestedUrl: string;
  /** The final address after redirects. */
  finalUrl: string;
  canonicalUrl: string | null;
  host: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  language: string | null;
  text: string;
  wordCount: number;
};

export type ReadArticleOptions = Omit<FetchPageOptions, "acceptTypes" | "accept" | "maxBytes" | "timeoutMs"> & {
  /** Crawler name matched against robots.txt rules. */
  agentToken: string;
};

/** Reads one article: validates the address, honors robots.txt, fetches safely, extracts the text. */
export async function readArticle(rawUrl: string, options: ReadArticleOptions): Promise<ArticleSource> {
  const url = parseUserUrl(rawUrl);
  const { agentToken, ...fetchOptions } = options;

  await assertRobotsAllow(url, agentToken, fetchOptions);
  const page = await fetchPage(url, { ...fetchOptions, timeoutMs: 10_000 });

  const extracted = extractReadable(page.text, page.finalUrl);
  const verdict = classifyExtraction(extracted);
  if (verdict === "paywall") throw new ExtractError("paywall");
  if (verdict === "too_little_text") throw new ExtractError("too_little_text");

  return {
    requestedUrl: url.href,
    finalUrl: page.finalUrl.href,
    canonicalUrl: extracted.canonicalUrl,
    host: page.finalUrl.hostname,
    title: extracted.title,
    description: extracted.description,
    siteName: extracted.siteName,
    language: extracted.language,
    text: extracted.text,
    wordCount: extracted.wordCount,
  };
}
