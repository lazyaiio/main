/** Hashtag cleaner (pure). */

export type HashtagStyle = "keep" | "camel" | "lower";
export type HashtagResult = { tags: string[]; duplicates: number; dropped: number; overLimit: number; text: string };

const CHUNK = /[^\p{L}\p{N}_]+/gu;

function toTag(chunk: string, style: HashtagStyle): string {
  const words = chunk.split(CHUNK).filter(Boolean);
  if (words.length === 0) return "";
  if (style === "camel") return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  if (style === "lower") return words.join("").toLowerCase();
  return words.join("");
}

/**
 * Turns messy text into clean, unique hashtags.
 *  - If the text has "#", each "#..." is one tag (words inside it are joined).
 *  - Otherwise commas and new lines separate tags; if there are none, each word is a tag.
 * `max` of 0 means no limit; tags beyond it are left out and counted in `overLimit`.
 */
export function cleanHashtags(input: string, style: HashtagStyle = "keep", max = 0): HashtagResult {
  const text = input.slice(0, 20000);
  let chunks: string[];
  if (text.includes("#")) chunks = text.split("#").slice(1).map((c) => c.replace(/[,;\n\r]+/g, " ").trim());
  else if (/[,;\n\r]/.test(text)) chunks = text.split(/[,;\n\r]+/);
  else chunks = text.split(/\s+/);

  const seen = new Set<string>();
  const tags: string[] = [];
  let duplicates = 0;
  let dropped = 0;
  for (const chunk of chunks) {
    if (chunk.trim() === "") continue;
    const tag = toTag(chunk, style);
    if (!tag || /^\d+$/.test(tag)) {
      dropped += 1;
      continue;
    }
    const key = tag.toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    tags.push(`#${tag}`);
  }
  const kept = max > 0 ? tags.slice(0, max) : tags;
  return { tags: kept, duplicates, dropped, overLimit: tags.length - kept.length, text: kept.join(" ") };
}
