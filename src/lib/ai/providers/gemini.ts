import { AiError } from "../errors";
import { asNumber, asRecord, postJson } from "../http";
import type { FetchLike, GenerateRequest, GenerateResult, TextGenerationProvider } from "../types";

export function createGeminiProvider(apiKey: string, fetchImpl: FetchLike = fetch): TextGenerationProvider {
  return {
    id: "gemini",
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      const generationConfig: Record<string, unknown> = { maxOutputTokens: req.maxTokens };
      if (req.json) generationConfig.responseMimeType = "application/json";

      const data = asRecord(
        await postJson(
          fetchImpl,
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent`,
          { "x-goog-api-key": apiKey },
          {
            systemInstruction: { parts: [{ text: req.system }] },
            contents: [{ role: "user", parts: [{ text: req.user }] }],
            generationConfig,
          },
          req.timeoutMs,
        ),
      );
      const candidates = Array.isArray(data.candidates) ? data.candidates : [];
      const parts = asRecord(asRecord(candidates[0]).content).parts;
      const text = (Array.isArray(parts) ? parts : [])
        .map((p) => asRecord(p).text)
        .filter((t): t is string => typeof t === "string")
        .join("");
      if (!text) throw new AiError("bad_response", "Empty or blocked response.");
      const usage = asRecord(data.usageMetadata);
      return {
        text,
        inputTokens: asNumber(usage.promptTokenCount),
        outputTokens: asNumber(usage.candidatesTokenCount),
      };
    },
  };
}
