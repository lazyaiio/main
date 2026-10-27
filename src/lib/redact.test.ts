import { describe, expect, it } from "vitest";
import { REDACTED, redactObject, redactText } from "./redact";

describe("redactObject", () => {
  it("hides values whose names look secret", () => {
    const out = redactObject({ access_token: "abc", apiKey: "k", Authorization: "Bearer x", password: "p", note: "hello", count: 3, cookie: "c" });
    expect(out).toEqual({ access_token: REDACTED, apiKey: REDACTED, Authorization: REDACTED, password: REDACTED, note: "hello", count: 3, cookie: REDACTED });
  });

  it("works inside nested objects and lists, and keeps empty secrets empty", () => {
    const out = redactObject({ page: { name: "Bakery", token: "t" }, list: [{ secret: "s" }], token: null });
    expect(out).toEqual({ page: { name: "Bakery", token: REDACTED }, list: [{ secret: REDACTED }], token: null });
  });

  it("stops at a safe depth instead of looping", () => {
    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let i = 0; i < 10; i++) {
      const next: Record<string, unknown> = {};
      cursor.child = next;
      cursor = next;
    }
    expect(JSON.stringify(redactObject(deep))).toContain(REDACTED);
  });
});

describe("redactText", () => {
  it("removes things that look like keys and tokens", () => {
    const samples = [
      "Authorization: Bearer abcdefghijklmnop12345",
      "key sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWx",
      "re_AbCdEfGhIjKlMnOpQrStUv123",
      "whsec_dGVzdC1zZWNyZXQta2V5LTAxMjM0NTY3ODk=",
      "EAAGm0PX4ZCpsBOxyzxyzxyzxyzxyzxyzxyzxyz",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk",
      "0123456789abcdef0123456789abcdef0123456789abcdef",
    ];
    for (const sample of samples) {
      const out = redactText(`before ${sample} after`);
      expect(out).toContain(REDACTED);
      expect(out.startsWith("before")).toBe(true);
    }
  });

  it("leaves ordinary text alone", () => {
    expect(redactText("Post scheduled for Page Bakery at 10:00")).toBe("Post scheduled for Page Bakery at 10:00");
    expect(redactText("uuid 11111111-1111-4111-8111-111111111111 ok")).toBe("uuid 11111111-1111-4111-8111-111111111111 ok");
  });
});
