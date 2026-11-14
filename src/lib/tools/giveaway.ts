/** Random winner picker for giveaways (pure; the random source is passed in so tests can control it). */

export type RandomInt = (maxExclusive: number) => number;

export const MAX_ENTRIES = 5000;
export const MAX_WINNERS = 20;

export type EntryList = { entries: string[]; duplicates: number; blank: number; tooMany: boolean };

/** One entry per line. Blank lines are skipped. With `unique`, repeated names (ignoring capital letters) count once. */
export function parseEntries(text: string, unique: boolean): EntryList {
  const seen = new Set<string>();
  const entries: string[] = [];
  let duplicates = 0;
  let blank = 0;
  for (const raw of text.slice(0, 400_000).split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, " ").trim().slice(0, 120);
    if (!line) {
      blank += 1;
      continue;
    }
    const key = line.toLowerCase();
    if (unique && seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    entries.push(line);
  }
  const tooMany = entries.length > MAX_ENTRIES;
  return { entries: tooMany ? entries.slice(0, MAX_ENTRIES) : entries, duplicates, blank, tooMany };
}

export type Draw = { ok: true; winners: string[]; backups: string[] } | { ok: false; error: string };

/**
 * Draws `winners` plus `backups` different entries by shuffling a copy (Fisher-Yates) with the given random source.
 * If one name appears several times (unique turned off) the same person can win only once.
 */
export function drawWinners(entries: string[], winners: number, backups: number, randomInt: RandomInt): Draw {
  if (!Number.isInteger(winners) || winners < 1) return { ok: false, error: "Choose how many winners to pick." };
  if (winners > MAX_WINNERS) return { ok: false, error: `Pick at most ${MAX_WINNERS} winners at a time.` };
  if (!Number.isInteger(backups) || backups < 0 || backups > MAX_WINNERS) return { ok: false, error: `Backups must be between 0 and ${MAX_WINNERS}.` };
  const distinct = Array.from(new Map(entries.map((e) => [e.toLowerCase(), e])).values());
  if (distinct.length === 0) return { ok: false, error: "Paste at least one entry first." };
  if (distinct.length < winners + backups) return { ok: false, error: `You asked for ${winners + backups} names but only ${distinct.length} different ${distinct.length === 1 ? "entry was" : "entries were"} pasted.` };
  const pool = [...distinct];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const t = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = t;
  }
  return { ok: true, winners: pool.slice(0, winners), backups: pool.slice(winners, winners + backups) };
}

/** An unbiased random integer from the browser's secure random source (rejects values that would skew the result). */
export function secureRandomInt(maxExclusive: number, getRandomValues: (a: Uint32Array) => Uint32Array = (a) => crypto.getRandomValues(a)): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1) throw new RangeError("maxExclusive must be a positive integer");
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  for (;;) {
    getRandomValues(buf);
    if (buf[0]! < limit) return buf[0]! % maxExclusive;
  }
}
