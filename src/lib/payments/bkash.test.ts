import { describe, expect, it } from "vitest";
import { BkashError, confirmsExpected, createPayment, executePayment, grantToken, isBkashRedirect, queryPayment, refundPayment, type BkashCredentials } from "./bkash";

const creds: BkashCredentials = { mode: "sandbox", appKey: "key", appSecret: "secret", username: "user", password: "pass" };

type Call = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

/** A fake bKash: answers by address and records what was sent. */
function fakeBkash(answers: Record<string, unknown>, calls: Call[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string>, body: JSON.parse(String(init?.body ?? "{}")) });
    const key = Object.keys(answers).find((k) => url.endsWith(k));
    if (!key) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(answers[key]), { status: 200 });
  }) as typeof fetch;
}

const grant = { statusCode: "0000", id_token: "TOKEN-123456789" };

describe("grantToken", () => {
  it("sends the username and password as headers and the key and secret in the body", async () => {
    const calls: Call[] = [];
    expect(await grantToken(creds, fakeBkash({ "/token/grant": grant }, calls))).toBe("TOKEN-123456789");
    expect(calls[0]?.url).toContain("tokenized.sandbox.bka.sh");
    expect(calls[0]?.headers.username).toBe("user");
    expect(calls[0]?.body).toEqual({ app_key: "key", app_secret: "secret" });
  });
  it("uses the live address in live mode", async () => {
    const calls: Call[] = [];
    await grantToken({ ...creds, mode: "live" }, fakeBkash({ "/token/grant": grant }, calls));
    expect(calls[0]?.url).toContain("tokenized.pay.bka.sh");
  });
  it("reports rejected credentials", async () => {
    await expect(grantToken(creds, fakeBkash({ "/token/grant": { statusCode: "2001", statusMessage: "Invalid" } }))).rejects.toMatchObject({ code: "rejected" });
  });
});

describe("createPayment", () => {
  const input = { amount: 500, invoiceNumber: "LZ123", callbackUrl: "https://app.example/cb?pid=1", payerReference: "user1" };
  it("sends the amount from our side and returns the bKash page", async () => {
    const calls: Call[] = [];
    const made = await createPayment(
      creds,
      input,
      fakeBkash({ "/token/grant": grant, "/create": { statusCode: "0000", paymentID: "TR0011abc", bkashURL: "https://sandbox.payment.bkash.com/redirect/tokenized/?paymentID=TR0011abc" } }, calls),
    );
    expect(made).toEqual({ paymentId: "TR0011abc", redirectUrl: "https://sandbox.payment.bkash.com/redirect/tokenized/?paymentID=TR0011abc" });
    const create = calls[1];
    expect(create?.headers.authorization).toBe("TOKEN-123456789");
    expect(create?.headers["x-app-key"]).toBe("key");
    expect(create?.body).toMatchObject({ mode: "0011", amount: "500.00", currency: "BDT", intent: "sale", merchantInvoiceNumber: "LZ123" });
  });
  it("refuses a redirect address that is not bKash", async () => {
    const answers = { "/token/grant": grant, "/create": { statusCode: "0000", paymentID: "TR0011abc", bkashURL: "https://evil.example/pay" } };
    await expect(createPayment(creds, input, fakeBkash(answers))).rejects.toBeInstanceOf(BkashError);
  });
  it("reports a refused payment", async () => {
    await expect(createPayment(creds, input, fakeBkash({ "/token/grant": grant, "/create": { statusCode: "2062" } }))).rejects.toMatchObject({ code: "rejected" });
  });
});

describe("isBkashRedirect", () => {
  it("accepts only https pages on bKash hosts", () => {
    expect(isBkashRedirect("https://sandbox.payment.bkash.com/x")).toBe(true);
    expect(isBkashRedirect("https://payment.bkash.com/x")).toBe(true);
    expect(isBkashRedirect("http://payment.bkash.com/x")).toBe(false);
    expect(isBkashRedirect("https://bkash.com.evil.example/x")).toBe(false);
    expect(isBkashRedirect("not a url")).toBe(false);
  });
});

describe("execute, query and confirmation", () => {
  const done = { statusCode: "0000", transactionStatus: "Completed", trxID: "ABC123", amount: "500.00", currency: "BDT", merchantInvoiceNumber: "LZ123", paymentID: "TR0011abc" };
  const expected = { amount: 500, invoiceNumber: "LZ123" };

  it("reads a completed payment", async () => {
    const result = await executePayment(creds, "TR0011abc", fakeBkash({ "/token/grant": grant, "/execute": done }));
    expect(result).toMatchObject({ status: "completed", trxId: "ABC123", amount: 500 });
    expect(confirmsExpected(result, expected)).toBe(true);
  });
  it("does not confirm a different amount or invoice", async () => {
    const less = await executePayment(creds, "TR0011abc", fakeBkash({ "/token/grant": grant, "/execute": { ...done, amount: "5.00" } }));
    expect(confirmsExpected(less, expected)).toBe(false);
    const other = await executePayment(creds, "TR0011abc", fakeBkash({ "/token/grant": grant, "/execute": { ...done, merchantInvoiceNumber: "LZ999" } }));
    expect(confirmsExpected(other, expected)).toBe(false);
  });
  it("does not confirm a failed payment", async () => {
    const result = await queryPayment(creds, "TR0011abc", fakeBkash({ "/token/grant": grant, "/payment/status": { statusCode: "2023", statusMessage: "Insufficient Balance" } }));
    expect(result.status).toBe("failed");
    expect(confirmsExpected(result, expected)).toBe(false);
  });
});

describe("refundPayment", () => {
  const input = { paymentId: "TR0011abc", trxId: "ABC123", amount: 500, reason: "Customer asked" };
  it("sends the original payment and transaction and the full amount", async () => {
    const calls: Call[] = [];
    const result = await refundPayment(creds, input, fakeBkash({ "/token/grant": grant, "/payment/refund": { statusCode: "0000", transactionStatus: "Completed", refundTrxID: "RF1" } }, calls));
    expect(result).toEqual({ status: "completed", refundTrxId: "RF1" });
    expect(calls[1]?.body).toMatchObject({ paymentID: "TR0011abc", trxID: "ABC123", amount: "500.00", reason: "Customer asked" });
  });
  it("does not report success without a refund transaction id", async () => {
    const result = await refundPayment(creds, input, fakeBkash({ "/token/grant": grant, "/payment/refund": { statusCode: "0000", transactionStatus: "Completed" } }));
    expect(result.status).toBe("failed");
  });
  it("reports a refusal", async () => {
    const result = await refundPayment(creds, input, fakeBkash({ "/token/grant": grant, "/payment/refund": { statusCode: "2062", statusMessage: "refused" } }));
    expect(result.status).toBe("failed");
  });
});
