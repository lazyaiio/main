export type AiErrorKind =
  | "auth"
  | "rate_limit"
  | "provider"
  | "timeout"
  | "network"
  | "bad_response"
  | "invalid_output"
  | "not_configured";

/** An AI failure with a safe message. Never contains keys, prompts, or raw provider responses. */
export class AiError extends Error {
  constructor(
    public readonly kind: AiErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/** Worth trying again (or trying another provider) without changing the request. */
export function isRetryable(kind: AiErrorKind): boolean {
  return kind === "rate_limit" || kind === "provider" || kind === "timeout" || kind === "network";
}

export function describeAiError(kind: AiErrorKind): string {
  switch (kind) {
    case "auth":
      return "The AI provider rejected the API key. Check the key in your environment settings.";
    case "rate_limit":
      return "The AI provider is rate limiting requests right now. Please try again in a minute.";
    case "provider":
      return "The AI provider had a problem. Please try again.";
    case "timeout":
      return "The AI provider took too long to answer. Please try again.";
    case "network":
      return "Could not reach the AI provider. Please try again.";
    case "bad_response":
      return "The AI provider rejected the request. The model name may be wrong.";
    case "invalid_output":
      return "The AI returned something we could not use. Please try again.";
    case "not_configured":
      return "AI generation is not set up yet. An admin needs to add an API key and turn on a provider.";
  }
}
