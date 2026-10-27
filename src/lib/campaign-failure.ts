import type { FailureInfo } from "@/lib/campaign-batch";

/**
 * Decides what to do when one post in a campaign fails. Errors are recognized by name so this file
 * stays free of server-only imports and can be tested without a network or a database.
 */
export function classifyFailure(error: unknown): FailureInfo {
  const name = error instanceof Error ? error.name : "";
  if (name === "ServiceError") {
    const kind = (error as Error & { kind?: string }).kind;
    switch (kind) {
      case "not_configured":
        return { code: "not_configured", retry: true, refund: true, stop: "not_configured" };
      case "rate_limited":
        return { code: "rate_limited", retry: true, refund: true, stop: "rate_limited" };
      case "invalid":
        return { code: "invalid_settings", retry: false, refund: false, stop: null };
      case "ai_failed":
        return { code: "ai_failed", retry: true, refund: false, stop: null };
      default:
        return { code: "unexpected", retry: true, refund: false, stop: null };
    }
  }
  if (name === "DataError") {
    // 53400 = the plan's limit was reached: stop the round and keep the slot for later.
    if ((error as Error & { code?: string }).code === "53400") return { code: "plan_limit", retry: true, refund: true, stop: "plan_limit" };
    return { code: "save_failed", retry: true, refund: false, stop: null };
  }
  return { code: "unexpected", retry: true, refund: false, stop: null };
}

/** Plain-language explanation of a slot's last error code, for the campaign page. */
export function describeSlotError(code: string | null): string | null {
  switch (code) {
    case null:
      return null;
    case "ai_failed":
      return "The AI could not write this post.";
    case "duplicate":
      return "Too similar to another post in this campaign.";
    case "timeout":
      return "This post took too long to write.";
    case "invalid_settings":
      return "The settings for this post are no longer valid.";
    case "save_failed":
      return "The post was written but could not be saved.";
    case "not_configured":
      return "AI generation is not set up.";
    case "rate_limited":
      return "The hourly generation limit was reached.";
    case "plan_limit":
      return "Your plan limit was reached.";
    case "out_of_time":
      return "Waiting for the next round.";
    default:
      return "Something went wrong with this post.";
  }
}
