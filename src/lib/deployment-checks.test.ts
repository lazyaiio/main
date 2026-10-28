import { describe, expect, it } from "vitest";
import {
  checkAppAddress,
  checkSettings,
  deploymentEnvironment,
  effectiveAppUrl,
  interpretProbe,
  registrationAddresses,
} from "./deployment-checks";

const find = (list: { id: string; state: string }[], id: string) => list.find((c) => c.id === id)?.state;

describe("deployment checks", () => {
  it("detects the environment", () => {
    expect(deploymentEnvironment({ VERCEL_ENV: "production" })).toBe("production");
    expect(deploymentEnvironment({ VERCEL_ENV: "preview" })).toBe("preview");
    expect(deploymentEnvironment({})).toBe("development");
  });

  it("follows the same address order as the app", () => {
    expect(effectiveAppUrl({ NEXT_PUBLIC_APP_URL: "https://a.com/" })).toBe("https://a.com");
    expect(effectiveAppUrl({ VERCEL_URL: "x.vercel.app" })).toBe("https://x.vercel.app");
    expect(effectiveAppUrl({})).toBe("http://localhost:3000");
  });

  it("flags bad production addresses", () => {
    const prod = { VERCEL_ENV: "production" };
    expect(find(checkAppAddress({ ...prod, NEXT_PUBLIC_APP_URL: "http://a.com" }, null), "app-url")).toBe("bad");
    expect(find(checkAppAddress({ ...prod, NEXT_PUBLIC_APP_URL: "http://localhost:3000" }, null), "app-url")).toBe("bad");
    expect(find(checkAppAddress({ ...prod, NEXT_PUBLIC_APP_URL: "not a url" }, null), "app-url")).toBe("bad");
    expect(find(checkAppAddress({ ...prod, NEXT_PUBLIC_APP_URL: "https://a.com/x" }, null), "app-url")).toBe("warn");
    expect(find(checkAppAddress({ ...prod, NEXT_PUBLIC_APP_URL: "https://a.vercel.app" }, null), "app-url")).toBe("warn");
    expect(find(checkAppAddress({ ...prod, NEXT_PUBLIC_APP_URL: "https://a.com" }, null), "app-url")).toBe("ok");
    expect(find(checkAppAddress(prod, null), "app-url")).toBe("warn");
  });

  it("compares the opened host with the app address in production only", () => {
    const prod = { VERCEL_ENV: "production", NEXT_PUBLIC_APP_URL: "https://a.com" };
    expect(find(checkAppAddress(prod, "a.com"), "app-url-host")).toBe("ok");
    expect(find(checkAppAddress(prod, "www.a.com"), "app-url-host")).toBe("warn");
    expect(find(checkAppAddress({ ...prod, VERCEL_ENV: "preview" }, "other.vercel.app"), "app-url-host")).toBeUndefined();
    expect(find(checkAppAddress({ ...prod, VERCEL_ENV: "preview" }, "other.vercel.app"), "app-url-preview")).toBe("warn");
  });

  it("never prints a setting value", () => {
    const secret = "SUPER-SECRET-VALUE-1234567890-ABCDEFGHIJKL";
    const all = checkSettings({ VERCEL_ENV: "production", CRON_SECRET: secret, TOKEN_ENCRYPTION_KEY: secret, RESEND_API_KEY: secret, ANTHROPIC_API_KEY: secret });
    expect(JSON.stringify(all)).not.toContain(secret);
  });

  it("applies the same length rules as the real readers", () => {
    expect(find(checkSettings({ CRON_SECRET: "short" }), "cron-secret")).toBe("warn");
    expect(find(checkSettings({ CRON_SECRET: "x".repeat(16) }), "cron-secret")).toBe("ok");
    expect(find(checkSettings({ TOKEN_ENCRYPTION_KEY: "x".repeat(31) }), "token-key")).toBe("warn");
    expect(find(checkSettings({ TOKEN_ENCRYPTION_KEY: "x".repeat(32) }), "token-key")).toBe("ok");
    expect(find(checkSettings({ RESEND_FROM_EMAIL: "LazyAI <hi@example.com>" }), "resend-from")).toBe("ok");
    expect(find(checkSettings({ RESEND_FROM_EMAIL: "nonsense" }), "resend-from")).toBe("warn");
  });

  it("makes missing required settings red only in production", () => {
    expect(find(checkSettings({ VERCEL_ENV: "production" }), "cron-secret")).toBe("bad");
    expect(find(checkSettings({ VERCEL_ENV: "preview" }), "cron-secret")).toBe("warn");
    expect(find(checkSettings({ VERCEL_ENV: "production" }), "resend-webhook")).toBe("off");
  });

  it("warns that test modes are ignored in production", () => {
    expect(find(checkSettings({ VERCEL_ENV: "production", AI_MOCK: "1", META_MOCK: "1" }), "ai-mock")).toBe("warn");
    expect(find(checkSettings({ VERCEL_ENV: "production", META_MOCK: "1" }), "meta-mock")).toBe("warn");
    expect(find(checkSettings({ AI_MOCK: "1" }), "ai-mock")).toBe("off");
    expect(find(checkSettings({ LIVE_PUBLISHING_ENABLED: "0" }), "live-block")).toBe("warn");
  });

  it("builds the addresses to register from the app address", () => {
    const list = registrationAddresses({ NEXT_PUBLIC_APP_URL: "https://a.com/" });
    const get = (label: string) => list.find((a) => a.label === label)?.value;
    expect(get("Meta valid OAuth redirect URI")).toBe("https://a.com/api/meta/callback");
    expect(get("Meta app domain")).toBe("a.com");
    expect(get("Resend webhook endpoint")).toBe("https://a.com/api/email/webhook");
    expect(get("Supabase redirect URL")).toBe("https://a.com/**");
    expect(get("Meta valid OAuth redirect URI")).not.toContain("//api");
    const custom = registrationAddresses({ NEXT_PUBLIC_APP_URL: "https://a.com", META_REDIRECT_URI: "https://a.com/custom" });
    expect(custom.find((a) => a.label === "Meta valid OAuth redirect URI")?.value).toBe("https://a.com/custom");
  });

  it("reads database probe errors", () => {
    expect(interpretProbe(null)).toBe("present");
    expect(interpretProbe({ code: "42501" })).toBe("present");
    expect(interpretProbe({ code: "42P01" })).toBe("missing");
    expect(interpretProbe({ code: "PGRST205" })).toBe("missing");
    expect(interpretProbe({ code: "XX000" })).toBe("unknown");
  });
});
