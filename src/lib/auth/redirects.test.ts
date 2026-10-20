import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./redirects";

describe("safeInternalPath", () => {
  it("allows in-app paths, including query strings", () => {
    expect(safeInternalPath("/app")).toBe("/app");
    expect(safeInternalPath("/app/content?x=1")).toBe("/app/content?x=1");
    expect(safeInternalPath("/onboarding")).toBe("/onboarding");
  });

  it("rejects external, protocol-relative, and malformed targets", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "/appx",
      "/auth/login",
      "javascript:alert(1)",
      "/app\n/evil",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(safeInternalPath(bad)).toBe("/app");
    }
  });

  it("supports a custom allow-list and fallback", () => {
    expect(safeInternalPath("/auth/reset-password", "/app", ["/auth/reset-password"])).toBe(
      "/auth/reset-password",
    );
    expect(safeInternalPath("/nope", "/home", ["/app"])).toBe("/home");
  });
});
