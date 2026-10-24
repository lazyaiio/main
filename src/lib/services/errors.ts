export type ServiceErrorKind =
  | "forbidden"
  | "not_found"
  | "in_use"
  | "failed"
  | "not_configured"
  | "rate_limited"
  | "ai_failed"
  | "source_failed"
  | "library_full"
  | "stock_limited"
  | "stock_failed"
  | "social_not_configured"
  | "social_denied"
  | "social_attempt_expired"
  | "social_page_in_use"
  | "social_token_expired"
  | "social_permission"
  | "social_page_lost"
  | "social_busy"
  | "social_scopes"
  | "social_no_pages"
  | "social_failed"
  | "invalid";

/** An expected failure with a message that is safe to show to the user. */
export class ServiceError extends Error {
  constructor(
    public readonly kind: ServiceErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
