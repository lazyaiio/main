export const PROVIDER_IDS = ["anthropic", "openai", "gemini", "openrouter"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export type GenerateRequest = {
  system: string;
  user: string;
  model: string;
  maxTokens: number;
  /** Ask the provider for JSON output when it supports a JSON mode. */
  json: boolean;
  timeoutMs: number;
};

export type GenerateResult = {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

/** Every AI backend (and the mock) implements this one interface. */
export interface TextGenerationProvider {
  readonly id: ProviderId | "mock";
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
