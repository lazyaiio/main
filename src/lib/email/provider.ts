import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Sending email through Resend, and checking Resend's delivery webhooks.
 * Pure: the API key, fetch, and secrets are passed in. No key ever appears in an error message.
 */

export type EmailMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Makes a repeated send with the same key a no-op at Resend (valid for 24 hours). */
  idempotencyKey?: string;
  /** Extra headers, for example List-Unsubscribe. */
  headers?: Record<string, string>;
};

export type EmailErrorKind = "not_configured" | "rejected" | "rate_limited" | "temporary" | "invalid";

export class EmailError extends Error {
  constructor(
    public readonly kind: EmailErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "EmailError";
  }
}

export const EMAIL_ERROR_TEXT: Record<EmailErrorKind, string> = {
  not_configured: "Email is not set up. Add RESEND_API_KEY and RESEND_FROM_EMAIL in your hosting settings.",
  rejected: "The email service rejected the request. Check that the API key is valid and the sending domain is verified.",
  rate_limited: "The email service is limiting requests. Try again in a few minutes.",
  temporary: "The email service had a temporary problem. Try again later.",
  invalid: "The email could not be sent because its details were not valid.",
};

const sendAnswer = z.object({ id: z.string().min(1).max(100) });

export function createResendSender(apiKey: string, fetchFn: typeof fetch = fetch) {
  return async function send(message: EmailMessage): Promise<{ id: string }> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (message.idempotencyKey) headers["Idempotency-Key"] = message.idempotencyKey.slice(0, 256);

    let response: Response;
    try {
      response = await fetchFn("https://api.resend.com/emails", {
        method: "POST",
        headers,
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.headers ? { headers: message.headers } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
    } catch {
      throw new EmailError("temporary", EMAIL_ERROR_TEXT.temporary);
    }

    if (response.status === 401 || response.status === 403) throw new EmailError("rejected", EMAIL_ERROR_TEXT.rejected);
    if (response.status === 429) throw new EmailError("rate_limited", EMAIL_ERROR_TEXT.rate_limited);
    if (response.status === 400 || response.status === 422) throw new EmailError("invalid", EMAIL_ERROR_TEXT.invalid);
    if (!response.ok) throw new EmailError("temporary", EMAIL_ERROR_TEXT.temporary);

    const parsed = sendAnswer.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new EmailError("temporary", EMAIL_ERROR_TEXT.temporary);
    return { id: parsed.data.id };
  };
}

// ---------------------------------------------------------------------------------------------
// Webhooks (Resend signs them with Svix)
// ---------------------------------------------------------------------------------------------

const TOLERANCE_SECONDS = 5 * 60;

/**
 * Verifies a Svix-signed webhook: the signature is HMAC-SHA256 over "<id>.<timestamp>.<raw body>" with
 * the secret (the part after "whsec_" is base64). The header may hold several space-separated "v1,<sig>"
 * values. Old timestamps are refused to stop replays.
 */
export function verifyWebhook(input: {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  secret: string;
  nowSeconds?: number;
}): boolean {
  const { id, timestamp, signature, body, secret } = input;
  if (!id || !timestamp || !signature || !secret) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return false;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - seconds) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

  for (const part of signature.split(" ")) {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) continue;
    let given: Buffer;
    try {
      given = Buffer.from(value, "base64");
    } catch {
      continue;
    }
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  return false;
}

export type DeliveryStatus = "sent" | "delivered" | "delayed" | "bounced" | "complained" | "failed";

const eventSchema = z.object({ type: z.string(), data: z.object({ email_id: z.string().min(1).max(100) }).passthrough() });

const STATUS_BY_TYPE: Record<string, DeliveryStatus> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
};

/** Maps a webhook body to one of our delivery statuses, or null for events we do not track. */
export function parseDeliveryEvent(body: string): { emailId: string; status: DeliveryStatus } | null {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const parsed = eventSchema.safeParse(json);
  if (!parsed.success) return null;
  const status = STATUS_BY_TYPE[parsed.data.type];
  return status ? { emailId: parsed.data.data.email_id, status } : null;
}

/** Statuses that mean "stop sending to this address". */
export function isSuppressingStatus(status: DeliveryStatus): boolean {
  return status === "bounced" || status === "complained";
}
