/** Free tool: Facebook post checker. Pure text analysis that runs in the visitor's browser. Nothing is sent anywhere. */

const CTA_WORDS = ["comment", "share", "tag a", "tag your", "click", "visit", "call", "message us", "send us a message", "dm us", "book", "order", "sign up", "learn more", "shop", "join", "reply", "tell us", "let us know", "follow", "subscribe", "reserve", "contact", "link in", "register", "download", "try it", "get yours", "save this"];

export type Metrics = {
  characters: number; words: number; sentences: number; avgWordsPerSentence: number; paragraphs: number;
  firstLine: string; firstLineLength: number; hashtags: number; links: number; emojis: number; questions: number;
  exclamations: number; capsWords: number; hasCallToAction: boolean; readingEase: number; readingLabel: string;
};

export type Tip = { level: "good" | "check"; text: string };

function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

export function readingLabel(ease: number): string {
  return ease >= 80 ? "Very easy to read" : ease >= 65 ? "Easy to read" : ease >= 50 ? "Fairly easy" : ease >= 30 ? "Hard to read" : "Very hard to read";
}

export function analyze(text: string): Metrics {
  const clean = text.replace(/\r\n?/g, "\n").trim();
  const words = clean.match(/[A-Za-z0-9\u00C0-\u024F]+(?:[’'-][A-Za-z0-9\u00C0-\u024F]+)*/g) ?? [];
  const sentenceParts = clean.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => /[A-Za-z0-9]/.test(s));
  const sentences = Math.max(sentenceParts.length, words.length > 0 ? 1 : 0);
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  const avg = sentences > 0 ? words.length / sentences : 0;
  const ease = words.length === 0 ? 0 : Math.round(Math.max(0, Math.min(100, 206.835 - 1.015 * avg - 84.6 * (syl / words.length))));
  const lower = clean.toLowerCase();
  const firstLine = clean.split("\n")[0] ?? "";
  return {
    characters: clean.length,
    words: words.length,
    sentences,
    avgWordsPerSentence: Math.round(avg * 10) / 10,
    paragraphs: clean ? clean.split(/\n\s*\n/).filter((p) => p.trim()).length : 0,
    firstLine,
    firstLineLength: firstLine.length,
    hashtags: (clean.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length,
    links: (clean.match(/https?:\/\/\S+/g) ?? []).length,
    emojis: (clean.match(/\p{Extended_Pictographic}/gu) ?? []).length,
    questions: (clean.match(/\?/g) ?? []).length,
    exclamations: (clean.match(/!/g) ?? []).length,
    capsWords: words.filter((w) => w.length >= 3 && w === w.toUpperCase() && /[A-Z]/.test(w)).length,
    hasCallToAction: CTA_WORDS.some((c) => lower.includes(c)),
    readingEase: ease,
    readingLabel: words.length === 0 ? "" : readingLabel(ease),
  };
}

/** Friendly suggestions. These are general writing guidelines, not Facebook rules. */
export function suggestions(m: Metrics): Tip[] {
  if (m.words === 0) return [];
  const tips: Tip[] = [];
  const add = (ok: boolean, good: string, check: string) => tips.push({ level: ok ? "good" : "check", text: ok ? good : check });
  add(m.firstLineLength > 0 && m.firstLineLength <= 110, "The first line is short, so the point comes across quickly.", `The first line is ${m.firstLineLength} characters long. Readers often decide from the first line, so try to make it short and clear.`);
  add(m.hasCallToAction, "There is a call to action.", "There is no clear next step. Tell readers what to do: comment, message you, visit, or order.");
  add(m.avgWordsPerSentence <= 20, "Sentences are a comfortable length.", `Sentences average ${m.avgWordsPerSentence} words. Split a few to make the post easier to read on a phone.`);
  add(m.paragraphs >= 2 || m.words < 40, "The text is broken into short parts.", "Add blank lines between ideas so the post is easy to scan.");
  add(m.hashtags <= 3, "The hashtag count is modest.", `${m.hashtags} hashtags can look crowded. Two or three relevant ones are usually enough.`);
  add(m.links <= 1, "There is at most one link.", `${m.links} links compete for attention. One clear link is easier to follow.`);
  add(m.capsWords <= 1, "No shouting in capital letters.", `${m.capsWords} words are in all capitals. Use them rarely; they can feel like shouting.`);
  add(m.exclamations <= 2, "Exclamation marks are used sparingly.", `${m.exclamations} exclamation marks is a lot. Keep a few for the moments that deserve them.`);
  add(m.emojis <= 5, "The emoji count is modest.", `${m.emojis} emojis. A few help, but too many make a post harder to read.`);
  add(m.readingEase >= 50, `Reading ease: ${m.readingLabel.toLowerCase()}.`, `Reading ease is ${m.readingEase} (${m.readingLabel.toLowerCase()}). Use shorter words and sentences.`);
  return tips;
}
