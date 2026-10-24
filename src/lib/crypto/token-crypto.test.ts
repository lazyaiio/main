import { describe, expect, it } from "vitest";
import { TokenCryptoError, decryptToken, encryptToken } from "./token-crypto";

const KEY = "a-long-random-secret-with-more-than-32-characters-1234";
const OTHER_KEY = "a-different-random-secret-with-more-than-32-characters";
const CONTEXT = "page:ws-1:123456";

describe("token encryption", () => {
  it("round-trips a token", () => {
    const stored = encryptToken(KEY, CONTEXT, "EAAB-page-access-token");
    expect(decryptToken(KEY, CONTEXT, stored)).toBe("EAAB-page-access-token");
  });

  it("never contains the plain token and uses the documented format", () => {
    const stored = encryptToken(KEY, CONTEXT, "EAAB-page-access-token");
    expect(stored).not.toContain("EAAB");
    expect(stored.split(".")).toHaveLength(4);
    expect(stored.startsWith("v1.")).toBe(true);
  });

  it("uses a new random IV every time", () => {
    expect(encryptToken(KEY, CONTEXT, "same")).not.toBe(encryptToken(KEY, CONTEXT, "same"));
  });

  it("fails with the wrong key, the wrong context, or tampered data", () => {
    const stored = encryptToken(KEY, CONTEXT, "secret-token");
    expect(() => decryptToken(OTHER_KEY, CONTEXT, stored)).toThrow();
    expect(() => decryptToken(KEY, "page:ws-2:123456", stored)).toThrow();
    const parts = stored.split(".");
    const flipped = [...parts.slice(0, 3), parts[3]!.slice(0, -2) + (parts[3]!.endsWith("AA") ? "BB" : "AA")].join(".");
    expect(() => decryptToken(KEY, CONTEXT, flipped)).toThrow();
    expect(() => decryptToken(KEY, CONTEXT, "garbage")).toThrow();
    expect(() => decryptToken(KEY, CONTEXT, "v2.a.b.c")).toThrow();
  });

  it("errors are generic and never leak the token or the key", () => {
    const stored = encryptToken(KEY, CONTEXT, "very-secret-token");
    try {
      decryptToken(OTHER_KEY, CONTEXT, stored);
      throw new Error("should have failed");
    } catch (error) {
      expect(error).toBeInstanceOf(TokenCryptoError);
      const message = (error as Error).message;
      expect(message).not.toContain("very-secret-token");
      expect(message).not.toContain(OTHER_KEY);
    }
  });

  it("refuses short keys and empty tokens", () => {
    expect(() => encryptToken("short", CONTEXT, "token")).toThrow();
    expect(() => encryptToken(KEY, CONTEXT, "")).toThrow();
  });
});
