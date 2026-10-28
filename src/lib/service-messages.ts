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
  source_failed: "We could not read that web page. Check the link and try again.",
  library_full: "Your media library is full. Delete some images to add more.",
  stock_limited: "You have reached the hourly stock photo limit. Please try again later.",
  stock_failed: "Stock photo search is not available right now. Try again later.",
  social_not_configured: "Facebook connection is not available yet. Please try again later or contact us.",
  social_denied: "The connection was canceled, or Facebook permissions were not granted. Try again and allow every permission shown.",
  social_attempt_expired: "That connection attempt expired or was already used. Start again with Connect Facebook.",
  social_page_in_use: "One of those Pages is already connected to another LazyAI workspace.",
  social_token_expired: "Facebook says this connection has expired or was removed. Reconnect the Page to continue.",
  social_permission: "LazyAI does not have permission to post to this Page. Reconnect and allow posting, and make sure your Facebook account can create posts on the Page.",
  social_page_lost: "This Page could not be reached. Your Facebook account may no longer have a role on it. Check your role on the Page, then reconnect.",
  social_busy: "Facebook is limiting requests or had a temporary problem. Wait a few minutes and try again.",
  social_scopes: "Facebook did not grant every permission LazyAI needs (show Pages, read engagement, and manage posts). Try again and allow all of them.",
  social_no_pages: "No Pages were found for that Facebook account. You need a role on at least one Page that lets you create posts.",
  social_failed: "Something went wrong while talking to Facebook. Try again, or reconnect the Page.",
  schedule_not_approved: "Only approved posts can be scheduled. Approve the post first.",
  schedule_time: "Choose a time at least a few minutes from now and within the next year.",
  schedule_page: "Choose a connected Facebook Page where you are allowed to post.",
  schedule_exists: "This post is already scheduled or published on that Page.",
  schedule_state: "That change is not possible for this post in its current state.",
  plan_limit: "You have reached the limit of your plan for this. Remove something you no longer need, or contact us to raise the limit.",
  too_many_requests: "You are doing that too often. Please wait a few minutes and try again.",
  account_password: "The password is not correct.",
  account_has_members: "Your workspace has other members. Remove them first, or contact us, before deleting the account.",
  invalid: "That change is not allowed right now.",
};

export function messageForCode(code: unknown): string | undefined {
  return typeof code === "string" && code in SERVICE_ERROR_MESSAGES
    ? SERVICE_ERROR_MESSAGES[code as ServiceErrorKind]
    : undefined;
}
