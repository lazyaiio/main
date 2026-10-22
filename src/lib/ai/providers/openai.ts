import { createOpenAiCompatibleProvider } from "./openai-compatible";
import type { FetchLike, TextGenerationProvider } from "../types";

export function createOpenAiProvider(apiKey: string, fetchImpl: FetchLike = fetch): TextGenerationProvider {
  return createOpenAiCompatibleProvider({
    id: "openai",
    url: "https://api.openai.com/v1/chat/completions",
    apiKey,
    fetchImpl,
    tokenField: "max_completion_tokens",
    supportsJsonMode: true,
  });
}
