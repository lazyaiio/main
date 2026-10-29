export const POST_FORMATS = [
  { value: "tip", label: "Tip", guidance: "One practical tip the reader can use today." },
  { value: "checklist", label: "Checklist", guidance: "A short checklist of 3 to 5 items." },
  { value: "question", label: "Question or poll prompt", guidance: "An engaging question that invites replies." },
  { value: "myth_vs_fact", label: "Myth vs. fact", guidance: "Name a common myth, then give the accurate version." },
  { value: "how_to", label: "How-to", guidance: "Simple numbered steps to get one thing done." },
  { value: "story", label: "Short story or scenario", guidance: "A brief, relatable scenario. Clearly fictional, never a fake customer testimonial." },
  { value: "educational", label: "Educational post", guidance: "Explain one idea clearly for a beginner." },
  { value: "promotion", label: "Product or service promotion", guidance: "Highlight one benefit without exaggerated claims. Do not invent prices or discounts." },
  { value: "discussion", label: "Community discussion prompt", guidance: "Start a friendly conversation about a shared experience." },
] as const;

export type PostFormat = (typeof POST_FORMATS)[number]["value"];
export const POST_FORMAT_VALUES = POST_FORMATS.map((f) => f.value) as [PostFormat, ...PostFormat[]];

export const POST_LENGTHS = [
  { value: "short", label: "Short (30 to 60 words)", guidance: "about 30 to 60 words" },
  { value: "medium", label: "Medium (60 to 120 words)", guidance: "about 60 to 120 words" },
  { value: "long", label: "Long (120 to 200 words)", guidance: "about 120 to 200 words" },
  {
    value: "extra_long",
    label: "Extra long (500 to 750 words)",
    guidance: "about 500 to 750 words, organized into short paragraphs with a clear opening, a developed middle, and a closing thought",
  },
] as const;

export type PostLength = (typeof POST_LENGTHS)[number]["value"];
export const POST_LENGTH_VALUES = POST_LENGTHS.map((l) => l.value) as [PostLength, ...PostLength[]];

export function formatLabel(value: string): string {
  return POST_FORMATS.find((f) => f.value === value)?.label ?? "Post";
}

/**
 * The most text the AI may write for one post. Longer posts need more room, and Bengali needs roughly
 * twice as many tokens as English for the same number of words.
 */
export function maxTokensFor(length: PostLength, language: "en" | "bn"): number {
  const base: Record<PostLength, number> = { short: 1200, medium: 1400, long: 2000, extra_long: 3600 };
  const tokens = base[length] * (language === "bn" ? 2 : 1);
  return Math.min(tokens, 8000);
}
