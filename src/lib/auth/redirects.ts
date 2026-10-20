export const DEFAULT_ALLOWED_PREFIXES = ["/app", "/onboarding"] as const;

/**
 * Only allow redirects to known in-app paths. Anything else (other sites, protocol-relative
 * URLs, backslashes, control characters) falls back to a safe default. Prevents open redirects.
 */
export function safeInternalPath(
  raw: unknown,
  fallback = "/app",
  allowedPrefixes: readonly string[] = DEFAULT_ALLOWED_PREFIXES,
): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if ([...value].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127)) return fallback;
  const pathOnly = value.split(/[?#]/)[0] ?? "";
  const allowed = allowedPrefixes.some(
    (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`),
  );
  return allowed ? value : fallback;
}
