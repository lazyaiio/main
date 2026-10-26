import { describe, expect, it } from "vitest";
import { EMAIL_ERROR_TEXT, EmailError, createResendSender, isSuppressingStatus, parseDeliveryEvent, verifyWebhook } from "./provider";
import { escapeHtml, oneLine, renderEmail } from "./templates";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const message = { from: "LazyAI <hello@mail.example.com>", to: "jane@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi", idempotencyKey: "welcome:u1" };

describe("createResendSender", () => {
  it("posts the message with the key and an idempotency key, and returns the id", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const send = createResendSender("re_secret_key_123", (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return json({ id: "msg_1" });
    }) as unknown as typeof fetch);
    expect(await send(message)).toEqual({ id: "msg_1" });
    expect(seen!.url).toBe("https://api.resend.com/emails");
    const headers = seen!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_secret_key_123");
    expect(headers["Idempotency-Key"]).toBe("welcome:u1");
    const body = JSON.parse(String(seen!.init.body));
    expect(body.to).toEqual(["jane@example.com"]);
    expect(body.subject).toBe("Hi");
  });

  it("turns each failure into a plain error that never contains the key", async () => {
    const cases: [number, string][] = [[401, "rejected"], [403, "rejected"], [429, "rate_limited"], [422, "invalid"], [400, "invalid"], [500, "temporary"], [503, "temporary"]];
    for (const [status, kind] of cases) {
      const send = createResendSender("re_secret_key_123", (async () => json({ message: "bad re_secret_key_123" }, status)) as unknown as typeof fetch);
      const error = await send(message).catch((e) => e);
      expect(error).toBeInstanceOf(EmailError);
      expect(error.kind).toBe(kind);
      expect(error.message).toBe(EMAIL_ERROR_TEXT[kind as keyof typeof EMAIL_ERROR_TEXT]);
      expect(error.message).not.toContain("re_secret_key_123");
    }
    const offline = createResendSender("re_secret_key_123", (() => Promise.reject(new Error("re_secret_key_123 timeout"))) as typeof fetch);
    const error = await offline(message).catch((e) => e);
    expect(error.kind).toBe("temporary");
    expect(error.message).not.toContain("re_secret_key_123");
  });

  it("rejects an answer without an id", async () => {
    const send = createResendSender("k", (async () => json({})) as unknown as typeof fetch);
    await expect(send(message)).rejects.toBeInstanceOf(EmailError);
  });
});

describe("verifyWebhook", () => {
  // Built independently with Python (hmac + hashlib + base64).
  const secret = "whsec_dGVzdC1zZWNyZXQta2V5LTAxMjM0NTY3ODlhYmNkZWY=";
  const body = '{"type":"email.delivered","data":{"email_id":"abc-123"}}';
  const good = { id: "msg_123", timestamp: "1700000000", signature: "v1,MpZjunm1z/xW2jROuE+i+3vNbd6+arO5ojuOrLZDiOw=", body, secret, nowSeconds: 1700000100 };

  it("accepts the exact signature (independent test vector)", () => {
    expect(verifyWebhook(good)).toBe(true);
  });

  it("accepts it among several signatures", () => {
    expect(verifyWebhook({ ...good, signature: `v1,AAAA ${good.signature}` })).toBe(true);
  });

  it("rejects changed bodies, ids, timestamps, secrets, and missing parts", () => {
    expect(verifyWebhook({ ...good, body: body.replace("abc", "abd") })).toBe(false);
    expect(verifyWebhook({ ...good, id: "msg_124" })).toBe(false);
    expect(verifyWebhook({ ...good, timestamp: "1700000001" })).toBe(false);
    expect(verifyWebhook({ ...good, secret: "whsec_b3RoZXItc2VjcmV0LWtleS0wMDAwMDAwMDAwMDAwMA==" })).toBe(false);
    expect(verifyWebhook({ ...good, signature: "v2,MpZjunm1z/xW2jROuE+i+3vNbd6+arO5ojuOrLZDiOw=" })).toBe(false);
    expect(verifyWebhook({ ...good, signature: null })).toBe(false);
    expect(verifyWebhook({ ...good, secret: "" })).toBe(false);
  });

  it("rejects old requests (replay protection)", () => {
    expect(verifyWebhook({ ...good, nowSeconds: 1700000000 + 6 * 60 })).toBe(false);
    expect(verifyWebhook({ ...good, nowSeconds: 1700000000 - 6 * 60 })).toBe(false);
  });
});

describe("parseDeliveryEvent", () => {
  it("maps Resend events to delivery statuses", () => {
    expect(parseDeliveryEvent('{"type":"email.delivered","data":{"email_id":"e1"}}')).toEqual({ emailId: "e1", status: "delivered" });
    expect(parseDeliveryEvent('{"type":"email.bounced","data":{"email_id":"e2","bounce":{}}}')).toEqual({ emailId: "e2", status: "bounced" });
    expect(parseDeliveryEvent('{"type":"email.complained","data":{"email_id":"e3"}}')?.status).toBe("complained");
    expect(parseDeliveryEvent('{"type":"email.delivery_delayed","data":{"email_id":"e4"}}')?.status).toBe("delayed");
  });
  it("ignores events we do not track and broken bodies", () => {
    expect(parseDeliveryEvent('{"type":"email.opened","data":{"email_id":"e1"}}')).toBeNull();
    expect(parseDeliveryEvent("not json")).toBeNull();
    expect(parseDeliveryEvent('{"type":"email.delivered","data":{}}')).toBeNull();
  });
  it("suppresses only after a bounce or complaint", () => {
    expect(isSuppressingStatus("bounced")).toBe(true);
    expect(isSuppressingStatus("complained")).toBe(true);
    expect(isSuppressingStatus("delivered")).toBe(false);
    expect(isSuppressingStatus("delayed")).toBe(false);
  });
});

describe("templates", () => {
  const app = "https://app.example.com/";

  it("renders every template with a subject, HTML, and text, and no raw secrets", () => {
    const all = [
      renderEmail({ template: "welcome", name: "Jane" }, app),
      renderEmail({ template: "campaign_complete", campaignName: "November tips", campaignId: "c-1", completed: 10, failed: 2, total: 12, ok: true }, app),
      renderEmail({ template: "campaign_complete", campaignName: "November tips", campaignId: "c-1", completed: 0, failed: 12, total: 12, ok: false }, app),
      renderEmail({ template: "publish_failed", pageName: "Bakery", postSnippet: "Fresh bread", code: "token_expired", itemId: "i-1" }, app),
      renderEmail({ template: "page_attention", pageName: "Bakery", problem: "token_expired" }, app),
      renderEmail({ template: "test" }, app),
    ];
    for (const mail of all) {
      expect(mail.subject.length).toBeGreaterThan(5);
      expect(mail.html).toContain("<html");
      expect(mail.text.length).toBeGreaterThan(20);
      expect(mail.subject).not.toMatch(/[\r\n]/);
    }
  });

  it("links to the right pages without a double slash", () => {
    expect(renderEmail({ template: "campaign_complete", campaignName: "x", campaignId: "c-1", completed: 1, failed: 0, total: 1, ok: true }, app).text).toContain("https://app.example.com/app/campaigns/c-1");
    expect(renderEmail({ template: "page_attention", pageName: "x", problem: "token_expired" }, app).text).toContain("https://app.example.com/app/pages");
  });

  it("escapes everything that comes from data (no HTML injection) and keeps subjects on one line", () => {
    const hostile = '<script>alert(1)</script>"\r\nBcc: evil@example.com';
    const mail = renderEmail({ template: "publish_failed", pageName: hostile, postSnippet: hostile, code: "unexpected", itemId: "i-1" }, app);
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });

  it("explains the reason in plain English", () => {
    expect(renderEmail({ template: "publish_failed", pageName: "P", postSnippet: "S", code: "uncertain_result", itemId: "i" }, app).text).toContain("will not post it again");
  });

  it("escape helpers behave", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    expect(oneLine("a\r\nb\tc   d", 50)).toBe("a b c d");
    expect(oneLine("x".repeat(500), 10).length).toBe(10);
  });
});
