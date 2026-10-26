import { NextResponse, type NextRequest } from "next/server";
import { applyDeliveryStatus, suppressUser } from "@/lib/data/email";
import { isSuppressingStatus, parseDeliveryEvent, verifyWebhook } from "@/lib/email/provider";
import { getEmailConfig } from "@/lib/email/keys";

export const dynamic = "force-dynamic";

/**
 * Resend calls this address when an email is delivered, delayed, bounced, or reported as spam. Every
 * call must carry a valid signature (checked with RESEND_WEBHOOK_SECRET); anything else gets a 401.
 * A bounce or a spam complaint pauses further emails to that person. The answer contains no data.
 */
export async function POST(request: NextRequest) {
  const secret = getEmailConfig().webhookSecret;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const body = await request.text();
  const valid = verifyWebhook({
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
    secret,
  });
  if (!valid) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const event = parseDeliveryEvent(body);
  if (!event) return NextResponse.json({ ok: true, ignored: true });

  try {
    const result = await applyDeliveryStatus(event.emailId, event.status);
    if (result?.userId && isSuppressingStatus(event.status)) await suppressUser(result.userId);
  } catch {
    // Ask Resend to try again later.
    return NextResponse.json({ error: "temporary" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
