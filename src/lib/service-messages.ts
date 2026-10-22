import type { ServiceErrorKind } from "@/lib/services/errors";

/** Safe, user-facing text for each kind of expected failure (used when an action redirects with ?error=code). */
export const SERVICE_ERROR_MESSAGES: Record<ServiceErrorKind, string> = {
  forbidden: "You do not have permission to do that.",
  not_found: "That item could not be found.",
  in_use: "That item is in use, so it cannot be deleted.",
  failed: "Something went wrong. Please try again.",
  not_configured: "AI generation is not set up yet. An admin needs to add an API key and turn on a provider.",
  rate_limited: "You have reached the hourly generation limit. Please try again later.",
  ai_failed: "The AI could not complete that request. Please try again in a moment.",
  invalid: "That change is not allowed right now.",
};

export function messageForCode(code: unknown): string | undefined {
  return typeof code === "string" && code in SERVICE_ERROR_MESSAGES
    ? SERVICE_ERROR_MESSAGES[code as ServiceErrorKind]
    : undefined;
}
