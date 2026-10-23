import type { GenerateRequest, GenerateResult, TextGenerationProvider } from "./types";

/**
 * Deterministic stand-in for a real AI provider. Used by automated tests and for trying the app
 * without an API key (never in production). The Bengali sample uses escape sequences on purpose:
 * no Bengali text may appear in the site's source files.
 */
const BENGALI_SAMPLE = {
  hook: "\u0986\u099c\u0995\u09c7\u09b0 \u099f\u09bf\u09aa",
  body: "\u099b\u09cb\u099f \u09ac\u09cd\u09af\u09ac\u09b8\u09be\u09b0 \u099c\u09a8\u09cd\u09af \u098f\u0995\u099f\u09bf \u09b8\u09b9\u099c \u09aa\u09b0\u09be\u09ae\u09b0\u09cd\u09b6: \u0995\u09cd\u09b0\u09c7\u09a4\u09be\u09a6\u09c7\u09b0 \u09aa\u09cd\u09b0\u09a4\u09bf\u099f\u09bf \u09ae\u09a8\u09cd\u09a4\u09ac\u09cd\u09af\u09c7\u09b0 \u0989\u09a4\u09cd\u09a4\u09b0 \u09a6\u09bf\u09a8\u0964 \u098f\u09a4\u09c7 \u09a4\u09be\u09b0\u09be \u09ac\u09c1\u099d\u09a4\u09c7 \u09aa\u09be\u09b0\u09c7\u09a8 \u09af\u09c7 \u0986\u09aa\u09a8\u09bf \u09a4\u09be\u09a6\u09c7\u09b0 \u0995\u09a5\u09be \u09b6\u09c1\u09a8\u099b\u09c7\u09a8\u0964",
  cta: "\u0986\u09aa\u09a8\u09be\u09b0 \u0985\u09ad\u09bf\u099c\u09cd\u099e\u09a4\u09be \u0995\u09ae\u09c7\u09a8\u09cd\u099f\u09c7 \u099c\u09be\u09a8\u09be\u09a8\u0964",
  hashtags: ["\u099b\u09cb\u099f\u09ac\u09cd\u09af\u09ac\u09b8\u09be"],
  image_brief: "A friendly shop owner replying to a customer message on a phone.",
  fact_check_flags: [] as string[],
};

const ENGLISH_SAMPLE = {
  hook: "Today\u2019s tip",
  body: "Small business tip: reply to every customer comment within a day. It shows people you are listening, and it keeps the conversation going.",
  cta: "Tell us your experience in the comments.",
  hashtags: ["smallbusiness", "customerservice"],
  image_brief: "A friendly shop owner replying to a customer message on a phone.",
  fact_check_flags: [] as string[],
};

/** Distinct English sentences, so test-mode campaigns do not repeat themselves. */
const ENGLISH_BANK = [
  "Reply to every customer comment within a day so people know you are listening.",
  "Post at the same times each week and your followers will start to expect you.",
  "Share one behind-the-scenes photo this week; people love seeing how things are made.",
  "Ask a simple question at the end of a post to invite replies.",
  "Thank your newest customer by name, with their permission, to build goodwill.",
  "Keep your first line short so it reads well in a crowded feed.",
  "Answer one common customer question in a short post instead of repeating it in private messages.",
  "Pin a helpful post at the top of your Page so new visitors see it first.",
  "Use one clear photo instead of three busy ones.",
  "Write the way you talk; friendly words travel further than formal ones.",
  "Review last month's most popular post and make a new one on the same idea.",
  "End with one clear next step, such as messaging you or visiting the shop.",
  "Save your best customer questions in one note and answer one each week.",
  "A short caption with a clear photo often beats a long one.",
  "Tell people what changed this week, even if it is small.",
  "Ask a regular customer if you can share their kind words.",
  "Share a quick before-and-after to show your work.",
  "Mention one thing you learned recently and how it helped.",
  "Post a simple price or hours reminder before a busy weekend.",
  "Invite readers to tag a friend who would enjoy your Page.",
  "Show the people behind the business; faces build trust.",
  "Keep a short list of topics so you never start from a blank page.",
  "Answer comments with a name and a thank you.",
  "Try one new post format this week and watch what people do with it.",
  "Explain a common mistake and how to avoid it in two sentences.",
  "Share a tool or habit that saves you ten minutes a day.",
  "Celebrate a small win with your followers.",
  "Preview what is coming next week to give people a reason to return.",
  "Use plain words instead of industry terms.",
  "Check your Page on your phone before you post.",
  "Ask followers to vote between two options you are considering.",
  "Remind people how to reach you, in one friendly line.",
  "Turn one long answer into three short posts over the month.",
  "Look at which posts got replies and write more like them.",
  "Offer one practical step that readers can do today.",
  "Say thank you to the people who share your posts.",

];

/** Deterministic shuffle (a small linear congruential generator keeps results repeatable). */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = (seed * 2654435761 + 12345) >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
}

/** Campaign prompts say "Campaign: post N of M"; each N (and retry) gets different sample text. */
function campaignSeed(prompt: string): number | null {
  const position = /Campaign: post (\d+) of/.exec(prompt);
  if (!position) return null;
  const attempt = /This is attempt (\d+)/.exec(prompt);
  return Number(position[1]) * 31 + (attempt ? Number(attempt[1]) * 97 : 0);
}

function variedSample(language: "bn" | "en", seed: number) {
  if (language === "bn") {
    const words = BENGALI_SAMPLE.body.split(" ");
    return {
      ...BENGALI_SAMPLE,
      hook: `${BENGALI_SAMPLE.hook} ${seed}`,
      body: shuffled(words, seed).join(" "),
    };
  }
  const picks = shuffled(ENGLISH_BANK, seed).slice(0, 3);
  return { ...ENGLISH_SAMPLE, hook: `Tip ${seed}: ${(picks[0] ?? "").split(" ").slice(0, 4).join(" ")}`, body: picks.join(" ") };
}

export function createMockProvider(): TextGenerationProvider {
  return {
    id: "mock",
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      if (req.user.includes("Reply with the single word OK")) {
        return { text: "OK", inputTokens: 10, outputTokens: 1 };
      }
      const language = req.user.includes("Language: Bengali") ? "bn" : "en";
      const seed = campaignSeed(req.user);
      const sample = seed !== null ? variedSample(language, seed) : language === "bn" ? BENGALI_SAMPLE : ENGLISH_SAMPLE;
      return { text: JSON.stringify(sample), inputTokens: 300, outputTokens: 120 };
    },
  };
}
