import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseSignedRequest } from "./signed-request";

// Built independently with Python (hmac + hashlib) so the check does not just test itself.
const VECTOR = "FOVuXdhkoWD2wEeXojKHRiHPmWJd9Zy7K_pCnuKtwcY.eyJhbGdvcml0aG0iOiJITUFDLVNIQTI1NiIsImlzc3VlZF9hdCI6MTcwMDAwMDAwMCwidXNlcl9pZCI6IjEyMzQ1Njc4OTAifQ";

function sign(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${signature}.${body}`;
}

describe("parseSignedRequest", () => {
  it("accepts a request signed with the app secret (independent test vector)", () => {
    expect(parseSignedRequest(VECTOR, "app-secret")).toEqual({ userId: "1234567890" });
  });

  it("rejects a wrong secret, a changed payload, and a changed signature", () => {
    expect(parseSignedRequest(VECTOR, "other-secret")).toBeNull();
    const [sig, payload] = VECTOR.split(".") as [string, string];
    const forged = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "999" })).toString("base64url");
    expect(parseSignedRequest(`${sig}.${forged}`, "app-secret")).toBeNull();
    expect(parseSignedRequest(`${sig.slice(0, -2)}AA.${payload}`, "app-secret")).toBeNull();
  });

  it("rejects malformed input", () => {
    for (const raw of ["", "nodot", "a.b.c", ".", "x".repeat(5000)]) expect(parseSignedRequest(raw, "app-secret")).toBeNull();
    expect(parseSignedRequest(VECTOR, "")).toBeNull();
  });

  it("requires the documented algorithm and a numeric user id", () => {
    expect(parseSignedRequest(sign({ algorithm: "HMAC-SHA256", user_id: 42 }, "s"), "s")).toEqual({ userId: "42" });
    expect(parseSignedRequest(sign({ algorithm: "none", user_id: "42" }, "s"), "s")).toBeNull();
    expect(parseSignedRequest(sign({ algorithm: "HMAC-SHA256", user_id: "4x2" }, "s"), "s")).toBeNull();
    expect(parseSignedRequest(sign({ algorithm: "HMAC-SHA256" }, "s"), "s")).toBeNull();
    expect(parseSignedRequest(sign({ algorithm: "HMAC-SHA256", user_id: "../etc" }, "s"), "s")).toBeNull();
  });
});
