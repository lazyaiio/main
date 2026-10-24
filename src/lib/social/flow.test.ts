import { describe, expect, it } from "vitest";
import { buildFlowCookie, hashNonce, isFlowExpired, newNonce, parseFlowCookie, verifyCallbackState } from "./flow";

const FLOW = "11111111-1111-4111-8111-111111111111";

describe("OAuth flow cookie and state", () => {
  it("creates long random nonces", () => {
    const a = newNonce();
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).not.toBe(newNonce());
  });

  it("round-trips the cookie and rejects malformed ones", () => {
    const nonce = newNonce();
    expect(parseFlowCookie(buildFlowCookie(FLOW, nonce))).toEqual({ flowId: FLOW, nonce });
    expect(parseFlowCookie(undefined)).toBeNull();
    expect(parseFlowCookie("")).toBeNull();
    expect(parseFlowCookie("nodot")).toBeNull();
    expect(parseFlowCookie(`not-a-uuid.${nonce}`)).toBeNull();
    expect(parseFlowCookie(`${FLOW}.short`)).toBeNull();
    expect(parseFlowCookie(`${FLOW}.${"!".repeat(43)}`)).toBeNull();
  });

  it("accepts the callback only when state, cookie, and stored hash all agree", () => {
    const nonce = newNonce();
    const storedHash = hashNonce(nonce);
    expect(verifyCallbackState({ urlState: nonce, cookieNonce: nonce, storedHash })).toBe(true);
    expect(verifyCallbackState({ urlState: newNonce(), cookieNonce: nonce, storedHash })).toBe(false); // forged state
    expect(verifyCallbackState({ urlState: nonce, cookieNonce: newNonce(), storedHash })).toBe(false); // other browser
    expect(verifyCallbackState({ urlState: nonce, cookieNonce: nonce, storedHash: hashNonce(newNonce()) })).toBe(false); // other attempt
    expect(verifyCallbackState({ urlState: null, cookieNonce: nonce, storedHash })).toBe(false);
    expect(verifyCallbackState({ urlState: "x", cookieNonce: nonce, storedHash })).toBe(false);
  });

  it("knows when an attempt has expired", () => {
    const now = new Date("2026-10-24T10:00:00Z");
    expect(isFlowExpired("2026-10-24T10:05:00Z", now)).toBe(false);
    expect(isFlowExpired("2026-10-24T10:00:00Z", now)).toBe(true);
    expect(isFlowExpired("2026-10-24T09:59:59Z", now)).toBe(true);
  });
});
