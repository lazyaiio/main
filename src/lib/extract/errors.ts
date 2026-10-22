export type ExtractErrorKind =
  | "invalid_url"
  | "unsupported_scheme"
  | "blocked_destination"
  | "too_many_redirects"
  | "unsafe_redirect"
  | "dns_failed"
  | "timeout"
  | "network"
  | "too_large"
  | "unsupported_type"
  | "not_found"
  | "access_denied"
  | "rate_limited"
  | "source_error"
  | "robots_disallowed"
  | "robots_unavailable"
  | "too_little_text"
  | "paywall";

const MESSAGES: Record<ExtractErrorKind, string> = {
  invalid_url: "That does not look like a valid web address.",
  unsupported_scheme: "Only http and https links are supported.",
  blocked_destination: "That address cannot be used. Please use a public web page.",
  too_many_redirects: "That link redirects too many times.",
  unsafe_redirect: "That link redirects somewhere that is not allowed.",
  dns_failed: "We could not find that website. Check the address and try again.",
  timeout: "The website took too long to respond.",
  network: "We could not connect to that website.",
  too_large: "That page is too large to read.",
  unsupported_type: "That link is not a web page we can read. It may be a PDF, an image, or a download.",
  not_found: "That page was not found.",
  access_denied: "That page is not publicly available. It may need a login or block automated readers.",
  rate_limited: "That website is asking us to slow down. Please try again later.",
  source_error: "The website had a problem. Please try again later.",
  robots_disallowed: "That website asks automated tools not to read this page, so we did not.",
  robots_unavailable: "We could not check whether that website allows automated reading, so we did not read it.",
  too_little_text: "We could not find enough readable text on that page. It may need JavaScript to load.",
  paywall: "This looks like a subscriber-only or login page, so we could not read the article.",
};

export function describeExtractError(kind: ExtractErrorKind): string {
  return MESSAGES[kind];
}

/** A failure while reading a web page. The message is safe to show to users. */
export class ExtractError extends Error {
  constructor(
    public readonly kind: ExtractErrorKind,
    message?: string,
  ) {
    super(message ?? MESSAGES[kind]);
    this.name = "ExtractError";
  }
}
