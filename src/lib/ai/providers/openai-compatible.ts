import { AiError } from "../errors";
import { asNumber, asRecord, postJson } from "../http";
import type { FetchLike, GenerateRequest, GenerateResult, ProviderId, TextGenerationProvider } from "../types";

type Options = {
  id: ProviderId;
  url: string;
  apiKey: string;
  fetchImpl: FetchLike;
  extraHeaders?: Record<string, string>;
  /** OpenAI uses max_completion_tokens; most compatible APIs still use max_tokens. */
  tokenField: "max_completion_tokens" | "max_tokens";
  supportsJsonMode: boolean;
};

/** Shared implementation for the OpenAI chat-completions format (OpenAI and OpenRouter). */
export function createOpenAiCompatibleProvider(options: Options): TextGenerationProvider {
  return {
    id: options.id,
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      const body: Record<string, unknown> = {
        model: req.model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        [options.tokenField]: req.maxTokens,
      };
      if (req.json && options.supportsJsonMode) body.response_format = { type: "json_object" };

      const data = asRecord(
        await postJson(
          options.fetchImpl,
          options.url,
          { authorization: `Bearer ${options.apiKey}`, ...options.extraHeaders },
          body,
          req.timeoutMs,
        ),
      );
      const choices = Array.isArray(data.choices) ? data.choices : [];
      const message = asRecord(asRecord(choices[0]).message);
      const text = typeof message.content === "string" ? message.content : "";
      if (!text) throw new AiError("bad_response", "Empty response.");
      const usage = asRecord(data.usage);
      return { text, inputTokens: asNumber(usage.prompt_tokens), outputTokens: asNumber(usage.completion_tokens) };
    },
  };
}
