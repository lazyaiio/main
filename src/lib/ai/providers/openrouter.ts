import { createOpenAiCompatibleProvider } from "./openai-compatible";
import type { FetchLike, TextGenerationProvider } from "../types";

export function createOpenRouterProvider(
  apiKey: string,
  appUrl: string,
  fetchImpl: FetchLike = fetch,
): TextGenerationProvider {
  return createOpenAiCompatibleProvider({
    id: "openrouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey,
    fetchImpl,
    extraHeaders: { "HTTP-Referer": appUrl, "X-Title": "LazyAI" },
    tokenField: "max_tokens",
    // Free models differ in JSON-mode support, so we rely on the prompt and validate the output.
    supportsJsonMode: false,
  });
}
