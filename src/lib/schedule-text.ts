import { describeSocialError, type SocialErrorKind } from "@/lib/social/provider";

const SOCIAL_KINDS: SocialErrorKind[] = ["token_expired", "permission_missing", "page_access_lost", "content_rejected", "invalid_request"];

/** Plain-language explanation of why a scheduled post is in trouble. */
export function describeScheduleError(code: string | null): string | null {
  switch (code) {
    case null:
    case "":
      return null;
    case "uncertain_result":
      return "We could not confirm whether this post reached Facebook. Check your Page, then choose an option below. LazyAI will not post it again on its own.";
    case "missed_window":
      return "This post was more than 6 hours late (for example during an outage), so it was not published automatically. Retry it or choose a new time.";
    case "not_approved":
      return "The post was canceled when its time came. Restore it, then retry.";
    case "post_missing":
      return "The post could not be found.";
    case "page_missing":
    case "page_disconnected":
      return "The Facebook Page was disconnected or removed. Connect it again, then schedule the post again.";
    case "token_missing":
    case "token_unreadable":
      return "LazyAI lost its saved access to the Page. Reconnect the Page, then retry.";
    case "rate_limited":
    case "temporary":
      return "Facebook asked us to wait. LazyAI will try again automatically.";
    case "image_download":
      return "The image could not be loaded. LazyAI will try again automatically.";
    case "not_configured":
      return "Facebook publishing is not set up.";
    case "permission_missing":
      return describeSocialError("permission_missing");
    default:
      if ((SOCIAL_KINDS as string[]).includes(code)) return describeSocialError(code as SocialErrorKind);
      return "Something went wrong while publishing. Retry, or reconnect the Page.";
  }
}

/** UTC moment -> "YYYY-MM-DDTHH:MM" in a timezone, the format of a datetime-local input. */
export function toLocalInputValue(iso: string | Date, timeZone: string): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
