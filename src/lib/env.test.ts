import { describe, expect, it } from "vitest";
import { parsePublicEnv, resolveAppUrl } from "./env";

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
