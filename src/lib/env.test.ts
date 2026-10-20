import { describe, expect, it } from "vitest";
import { parsePublicEnv, parseSupabasePublicEnv, resolveAppUrl } from "./env";

describe("resolveAppUrl", () => {
  it("prefers NEXT_PUBLIC_APP_URL", () => {
    expect(resolveAppUrl({ NEXT_PUBLIC_APP_URL: "https://lazyai.io", VERCEL_URL: "x.vercel.app" })).toBe(
      "https://lazyai.io",
    );
  });

  it("falls back to the Vercel host, then localhost", () => {
    expect(resolveAppUrl({ VERCEL_URL: "lazyai-git-main.vercel.app" })).toBe(
      "https://lazyai-git-main.vercel.app",
    );
    expect(resolveAppUrl({})).toBe("http://localhost:3000");
  });
});

describe("parsePublicEnv", () => {
  it("accepts a valid URL", () => {
    expect(parsePublicEnv({ NEXT_PUBLIC_APP_URL: "https://lazyai.io" }).NEXT_PUBLIC_APP_URL).toBe(
      "https://lazyai.io",
    );
  });

  it("rejects an invalid URL", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_APP_URL: "not a url" })).toThrow();
  });
});

describe("parseSupabasePublicEnv", () => {
  const key = "k".repeat(40);

  it("returns null when anything is missing or malformed", () => {
    expect(parseSupabasePublicEnv({})).toBeNull();
    expect(parseSupabasePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://a.supabase.co" })).toBeNull();
    expect(
      parseSupabasePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "nope", NEXT_PUBLIC_SUPABASE_ANON_KEY: key }),
    ).toBeNull();
  });

  it("returns the config when valid", () => {
    expect(
      parseSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: " https://a.supabase.co ",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
      }),
    ).toEqual({ url: "https://a.supabase.co", anonKey: key });
  });
});
