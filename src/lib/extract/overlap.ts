const WORD_SPLIT = /[^\p{L}\p{M}\p{N}]+/u;

function words(text: string): string[] {
  return text.normalize("NFKC").toLowerCase().split(WORD_SPLIT).filter(Boolean);
}

function shingles(tokens: string[], size: number): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i + size <= tokens.length; i++) set.add(tokens.slice(i, i + size).join(" "));
  return set;
}

/**
 * Share (0 to 1) of the post's word sequences that appear word-for-word in the source.
 * A high number means the post copies the source instead of rewriting it.
 */
export function sourceOverlap(post: string, source: string, size = 6): number {
  const postTokens = words(post);
  if (postTokens.length < size) return 0;
  const postShingles = shingles(postTokens, size);
  if (postShingles.size === 0) return 0;
  const sourceShingles = shingles(words(source), size);
  let shared = 0;
  for (const s of postShingles) if (sourceShingles.has(s)) shared++;
  return shared / postShingles.size;
}
