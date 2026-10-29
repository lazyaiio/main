/**
 * Turns a post's "image idea" (a sentence written by the AI) into short phrases that work well as stock photo
 * searches. Pure and easy to test. The first phrase is the most specific, the last is the most general.
 */

const FILLER = new Set([
  "a", "an", "the", "of", "with", "and", "or", "in", "on", "at", "to", "for", "from", "by", "into", "over", "near",
  "photo", "photograph", "picture", "image", "illustration", "shot", "showing", "shows", "show", "featuring", "features",
  "close", "up", "closeup", "view", "scene", "that", "is", "are", "being", "while", "their", "his", "her", "its", "your", "our",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]+/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ""))
    .filter((w) => w.length > 1 && !FILLER.has(w));
}

export function stockQueryCandidates(imageBrief: string | null | undefined, topic: string | null | undefined): string[] {
  const out: string[] = [];
  const add = (list: string[], max: number) => {
    const phrase = list.slice(0, max).join(" ").trim();
    if (phrase.length >= 2 && !out.includes(phrase)) out.push(phrase);
  };
  const brief = words(imageBrief ?? "");
  const subject = words(topic ?? "");
  add(brief, 5);
  add(brief, 3);
  add(subject, 3);
  add(subject, 2);
  if (out.length === 0) out.push("business");
  return out.slice(0, 4);
}

/** Picks the first photo that is landscape, large enough, and not already used. */
export function pickPhoto<T extends { width: number; height: number; sourcePageUrl: string }>(photos: T[], usedPages: ReadonlySet<string>): T | null {
  const fresh = photos.filter((p) => !usedPages.has(p.sourcePageUrl));
  return fresh.find((p) => p.width >= p.height && p.width >= 1000) ?? fresh.find((p) => p.width >= 800) ?? fresh[0] ?? null;
}
