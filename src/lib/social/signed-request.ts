import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checks the "signed_request" Meta sends to the data deletion and deauthorize callbacks.
 * Format: <signature>.<payload>, both base64url. The signature is HMAC-SHA256 of the payload text
 * made with the app secret. Anything that does not verify is rejected.
 */
export function parseSignedRequest(raw: string, appSecret: string): { userId: string } | null {
  if (!raw || raw.length > 4000 || !appSecret) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [signaturePart, payloadPart] = parts as [string, string];

  let signature: Buffer;
  try {
    signature = Buffer.from(signaturePart, "base64url");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", appSecret).update(payloadPart).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as { algorithm?: unknown; user_id?: unknown };
    if (typeof payload.algorithm !== "string" || payload.algorithm.toUpperCase() !== "HMAC-SHA256") return null;
    const userId = typeof payload.user_id === "number" ? String(payload.user_id) : payload.user_id;
    if (typeof userId !== "string" || !/^\d{1,25}$/.test(userId)) return null;
    return { userId };
  } catch {
    return null;
  }
}
