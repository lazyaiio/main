import { AiError } from "../errors";
import { asNumber, asRecord, postJson } from "../http";
import type { FetchLike, GenerateRequest, GenerateResult, TextGenerationProvider } from "../types";

export function createAnthropicProvider(apiKey: string, fetchImpl: FetchLike = fetch): TextGenerationProvider {
  return {
    id: "anthropic",
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      const data = asRecord(
        await postJson(
          fetchImpl,
          "https://api.anthropic.com/v1/messages",
          { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          {
            model: req.model,
            max_tokens: req.maxTokens,
            system: req.system,
            messages: [{ role: "user", content: req.user }],
          },
          req.timeoutMs,
        ),
      );
      const blocks = Array.isArray(data.content) ? data.content : [];
      const text = blocks
        .map((b) => asRecord(b))
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text as string)
        .join("");
      if (!text) throw new AiError("bad_response", "Empty response.");
      const usage = asRecord(data.usage);
      return { text, inputTokens: asNumber(usage.input_tokens), outputTokens: asNumber(usage.output_tokens) };
    },
  };
}
