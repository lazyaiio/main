import { AiError } from "./errors";
import { sourceOverlap } from "@/lib/extract/overlap";
import { PROMPT_VERSION, SYSTEM_PROMPT, buildPostPrompt, buildRepairPrompt, type PromptSource } from "./prompts";
import { checkLanguage, extractJsonObject, postOutputSchema, type PostOutput, type PostRequest } from "./post-schema";
import type { RouterRequest, RouterResult } from "./router";

export type GeneratedPost = {
  output: PostOutput;
  provider: string;
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  repaired: boolean;
  calls: number;
};

type Run = (request: RouterRequest) => Promise<RouterResult>;

/** More than this share of the post copied word-for-word from the source is rejected. */
export const MAX_SOURCE_OVERLAP = 0.2;

function validate(
  text: string,
  language: "en" | "bn",
  source?: PromptSource | null,
): { ok: true; output: PostOutput } | { ok: false; problems: string } {
  let raw: unknown;
  try {
    raw = extractJsonObject(text);
  } catch {
    return { ok: false, problems: "the answer was not a single valid JSON object" };
  }
  const parsed = postOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "answer"}: ${i.message}`).join("; ");
    return { ok: false, problems: issues };
  }
  const languageProblem = checkLanguage(parsed.data.body, language);
  if (languageProblem) return { ok: false, problems: languageProblem };
  if (source && sourceOverlap(parsed.data.body, source.text) > MAX_SOURCE_OVERLAP) {
    return { ok: false, problems: "the post copies too much wording from the source article; rewrite it completely in your own words" };
  }
  return { ok: true, output: parsed.data };
}

/**
 * Builds the prompt, calls the AI, and validates the result. If the first answer is unusable it
 * makes exactly one repair attempt, then gives up with a clear error.
 */
export async function generatePostContent(
  input: PostRequest,
  run: Run,
  source?: PromptSource | null,
): Promise<GeneratedPost> {
  const base = { system: SYSTEM_PROMPT, maxTokens: 1200, json: true } as const;

  const first = await run({ ...base, user: buildPostPrompt(input, source) });
  let inputTokens = first.inputTokens ?? 0;
  let outputTokens = first.outputTokens ?? 0;

  const firstCheck = validate(first.text, input.language, source);
  if (firstCheck.ok) {
    return {
      output: firstCheck.output,
      provider: first.provider,
      model: first.model,
      promptVersion: PROMPT_VERSION,
      inputTokens,
      outputTokens,
      repaired: false,
      calls: 1,
    };
  }

  const second = await run({ ...base, user: buildRepairPrompt(first.text, firstCheck.problems) });
  inputTokens += second.inputTokens ?? 0;
  outputTokens += second.outputTokens ?? 0;

  const secondCheck = validate(second.text, input.language, source);
  if (!secondCheck.ok) {
    throw new AiError("invalid_output", "The AI output was invalid after one repair attempt.");
  }
  return {
    output: secondCheck.output,
    provider: second.provider,
    model: second.model,
    promptVersion: PROMPT_VERSION,
    inputTokens,
    outputTokens,
    repaired: true,
    calls: 2,
  };
}
