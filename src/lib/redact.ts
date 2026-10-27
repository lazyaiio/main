/**
 * Keeps secrets out of logs and audit records. Anything whose NAME suggests a secret is replaced, and so
 * is any text that LOOKS like a key or token (long unbroken strings, bearer headers, well-known prefixes).
 * Pure functions, used by the audit trail and the server logger.
 */

const SECRET_NAME = /(token|secret|password|passwd|authorization|api[_-]?key|apikey|private[_-]?key|ciphertext|cookie|signature|credential|signed_request)/i;
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+\/=-]{8,}/g,
  /\b(?:sk|pk|rk)[-_](?:live|test|ant|proj)?[-_]?[A-Za-z0-9_-]{16,}/g,
  /\bre_[A-Za-z0-9_]{16,}/g,
  /\bwhsec_[A-Za-z0-9+\/=]{16,}/g,
  /\bEAA[A-Za-z0-9]{20,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, // JSON web tokens
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\b[A-Za-z0-9+\/_=-]{40,}\b/g, // any long unbroken run (keys, tokens, hashes)
];

export const REDACTED = "[redacted]";

export function redactText(text: string): string {
  let out = text;
  for (const pattern of SECRET_VALUE_PATTERNS) out = out.replace(pattern, REDACTED);
  return out;
}

export function redactValue(key: string, value: unknown, depth = 0): unknown {
  if (SECRET_NAME.test(key)) return value === null || value === undefined ? value : REDACTED;
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return depth > 4 ? REDACTED : value.map((item) => redactValue(key, item, depth + 1));
  if (value && typeof value === "object") return depth > 4 ? REDACTED : redactObject(value as Record<string, unknown>, depth + 1);
  return value;
}

export function redactObject(input: Record<string, unknown>, depth = 0): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) out[key] = redactValue(key, value, depth);
  return out;
}
