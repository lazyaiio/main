import { describe, expect, it } from "vitest";
import {
  firstError,
  profileSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./schemas";

describe("signUpSchema", () => {
  it("normalises email and trims the name", () => {
    const out = signUpSchema.parse({
      displayName: "  Rahim ",
      email: "  Rahim@Example.COM ",
      password: "longenough",
    });
    expect(out).toEqual({ displayName: "Rahim", email: "rahim@example.com", password: "longenough" });
  });

  it("rejects short passwords and bad emails with readable messages", () => {
    const short = signUpSchema.safeParse({ displayName: "A", email: "a@b.co", password: "short" });
    expect(short.success).toBe(false);
    if (!short.success) expect(firstError(short.error)).toBe("Use at least 8 characters.");

    const bad = signUpSchema.safeParse({ displayName: "A", email: "nope", password: "longenough" });
    expect(bad.success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("requires both fields", () => {
    expect(signInSchema.safeParse({ email: "", password: "" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("requires matching passwords", () => {
    expect(resetPasswordSchema.safeParse({ password: "longenough", confirmPassword: "different" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "longenough", confirmPassword: "longenough" }).success).toBe(true);
  });
});

describe("profileSchema", () => {
  const base = { displayName: "Rahim", workspaceName: "My shop", preferredLanguage: "bn", timezone: "Asia/Dhaka" };

  it("accepts valid input", () => {
    expect(profileSchema.safeParse(base).success).toBe(true);
  });

  it("rejects unknown languages and invalid timezones", () => {
    expect(profileSchema.safeParse({ ...base, preferredLanguage: "fr" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, timezone: "Mars/Base" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, workspaceName: "   " }).success).toBe(false);
  });
});
