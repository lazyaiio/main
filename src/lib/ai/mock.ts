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

export function createMockProvider(): TextGenerationProvider {
  return {
    id: "mock",
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      if (req.user.includes("Reply with the single word OK")) {
        return { text: "OK", inputTokens: 10, outputTokens: 1 };
      }
      const sample = req.user.includes("Language: Bengali") ? BENGALI_SAMPLE : ENGLISH_SAMPLE;
      return { text: JSON.stringify(sample), inputTokens: 300, outputTokens: 120 };
    },
  };
}
