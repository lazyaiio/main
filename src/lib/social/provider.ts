/**
 * The contract between LazyAI and a social network. Today there is one real adapter (Meta / Facebook
 * Pages) and one mock for trying the product without a Facebook account.
 */

export type PageGrant = {
  id: string;
  name: string;
  category: string | null;
  /** What the connecting person may do on the Page, for example CREATE_CONTENT or MANAGE. */
  tasks: string[];
  /** Server-only. Never send this to the browser or write it to logs. */
  accessToken: string;
  /** True when the person's role on the Page allows creating posts. */
  canPublish: boolean;
};

export type TokenInfo = {
  valid: boolean;
  userId: string | null;
  scopes: string[];
  /** null = does not expire */
  expiresAt: Date | null;
  dataAccessExpiresAt: Date | null;
};

export type PublishInput = {
  message: string;
  link?: string | null;
  image?: { bytes: Uint8Array; mime: string } | null;
};

export type PublishResult = { providerPostId: string };

export type SocialErrorKind =
  | "denied" // the person pressed Cancel or refused permissions
  | "token_expired"
  | "permission_missing"
  | "page_access_lost"
  | "rate_limited"
  | "temporary"
  | "content_rejected"
  | "invalid_request"
  | "not_configured"
  | "unknown";

export class SocialError extends Error {
  constructor(
    public readonly kind: SocialErrorKind,
    message: string,
    /** Safe details for support (codes only, never tokens). */
    public readonly details: { status?: number; code?: number; subcode?: number; trace?: string } = {},
  ) {
    super(message);
    this.name = "SocialError";
  }
}

export interface SocialPublishingProvider {
  readonly id: "meta" | "mock";
  /** Permissions the connecting person must grant for publishing to work. */
  readonly requiredScopes: readonly string[];
  buildAuthorizationUrl(input: { state: string; redirectUri: string }): string;
  exchangeCode(input: { code: string; redirectUri: string }): Promise<{ accessToken: string }>;
  /** Swaps a short-lived user token for a long-lived one. */
  extendUserToken(token: string): Promise<{ accessToken: string }>;
  inspectToken(token: string): Promise<TokenInfo>;
  listPages(userToken: string): Promise<{ user: { id: string; name: string }; pages: PageGrant[] }>;
  /** Confirms a stored Page token still works. Throws SocialError when it does not. */
  checkPage(page: { id: string; accessToken: string }): Promise<{ name: string }>;
  /** Publishes now. Not connected to any screen yet (publishing starts in Batch 9). */
  publish(page: { id: string; accessToken: string }, input: PublishInput): Promise<PublishResult>;
}

/** Plain-language, actionable text for each kind of problem. */
export function describeSocialError(kind: SocialErrorKind): string {
  switch (kind) {
    case "denied":
      return "The connection was canceled, or Facebook permissions were not granted. Try again and allow every permission shown.";
    case "token_expired":
      return "Facebook says this connection has expired or was removed. Reconnect the Page to continue.";
    case "permission_missing":
      return "LazyAI does not have permission to post to this Page. Reconnect and allow posting for the Page, and make sure your Facebook account can create posts on it.";
    case "page_access_lost":
      return "This Page could not be reached. Your Facebook account may no longer have a role on it. Check your role on the Page, then reconnect.";
    case "rate_limited":
      return "Facebook is limiting requests right now. Wait a few minutes and try again.";
    case "temporary":
      return "Facebook had a temporary problem. Try again in a few minutes.";
    case "content_rejected":
      return "Facebook did not accept this content. Edit the post and try again.";
    case "invalid_request":
      return "Facebook did not accept the request. Reconnect the Page, and contact support if this keeps happening.";
    case "not_configured":
      return "Facebook connection is not set up yet. An admin needs to finish the Meta app setup.";
    default:
      return "Something went wrong while talking to Facebook. Try again, or reconnect the Page.";
  }
}
