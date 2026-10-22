export type ServiceErrorKind =
  | "forbidden"
  | "not_found"
  | "in_use"
  | "failed"
  | "not_configured"
  | "rate_limited"
  | "ai_failed"
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
