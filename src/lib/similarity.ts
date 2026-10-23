/**
 * Near-duplicate detection for posts in one campaign.
 * Works for English and Bengali: it compares runs of three words, ignoring case and punctuation.
 */

const WORD_SPLIT = /[^\p{L}\p{M}\p{N}]+/u;

/** At or above this share of identical three-word runs, two posts count as near-duplicates. */
export const NEAR_DUPLICATE_THRESHOLD = 0.5;

function words(text: string): string[] {
  return text.normalize("NFKC").toLowerCase().split(WORD_SPLIT).filter(Boolean);
}

function shingleSet(tokens: string[], size: number): Set<string> {
  const set = new Set<string>();
  if (tokens.length < size) {
    if (tokens.length > 0) set.add(tokens.join(" "));
    return set;
  }
  for (let i = 0; i + size <= tokens.length; i++) set.add(tokens.slice(i, i + size).join(" "));
  return set;
}

/** Jaccard similarity (0 to 1) of the three-word runs of two texts. */
export function similarity(a: string, b: string): number {
  const first = shingleSet(words(a), 3);
  const second = shingleSet(words(b), 3);
  if (first.size === 0 || second.size === 0) return 0;
  let shared = 0;
  for (const item of first) if (second.has(item)) shared++;
  return shared / (first.size + second.size - shared);
}

function normalizeLine(text: string | null | undefined): string {
  return words(text ?? "").join(" ");
}

export type Comparable = { id?: string; hook: string | null; body: string };

export type Duplicate = { id: string | null; score: number; reason: "same_hook" | "similar_text" };

/** The first existing post that the candidate repeats, or null when it is different enough. */
export function findNearDuplicate(
  candidate: Comparable,
  existing: readonly Comparable[],
  threshold = NEAR_DUPLICATE_THRESHOLD,
): Duplicate | null {
  const hook = normalizeLine(candidate.hook);
  let best: Duplicate | null = null;
  for (const other of existing) {
    if (hook.length >= 8 && hook === normalizeLine(other.hook)) {
      return { id: other.id ?? null, score: 1, reason: "same_hook" };
    }
    const score = similarity(candidate.body, other.body);
    if (score >= threshold && (!best || score > best.score)) {
      best = { id: other.id ?? null, score, reason: "similar_text" };
    }
  }
  return best;
}

/** Openings of the most recent posts, so the next prompt can steer away from them. */
export function recentHooks(existing: readonly Comparable[], max = 12): string[] {
  const hooks: string[] = [];
  for (let i = existing.length - 1; i >= 0 && hooks.length < max; i--) {
    const post = existing[i];
    if (!post) continue;
    const line = (post.hook || post.body).replace(/\s+/g, " ").trim();
    if (line) hooks.push(line.slice(0, 100));
  }
  return hooks.reverse();
}
