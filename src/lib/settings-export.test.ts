import { describe, expect, it } from "vitest";
import { EXPORTABLE_SETTING_KEYS, exportFilename, pickExportableSettings, stripSecrets } from "./settings-export";

describe("pickExportableSettings", () => {
  it("keeps only the allowed settings", () => {
    const out = pickExportableSettings([
      { key: "seo", value: { homeTitle: "LazyAI" } },
      { key: "bkash", value: { appKey: "enc:1", appSecret: "enc:2" } },
      { key: "stock_photos", value: { pixabayKey: "k" } },
      { key: "site_notice", value: { announcement: { enabled: true } } },
    ]);
    expect(Object.keys(out).sort()).toEqual(["seo", "site_notice"]);
  });
  it("never lists a payment or key setting as exportable", () => {
    expect(EXPORTABLE_SETTING_KEYS).not.toContain("bkash");
    expect(EXPORTABLE_SETTING_KEYS).not.toContain("stock_photos");
  });
});

describe("stripSecrets", () => {
  it("removes secret-looking properties at every depth", () => {
    const out = stripSecrets({ a: 1, apiKey: "x", nested: { Password: "p", token: "t", ok: "yes" }, list: [{ clientSecret: "s", name: "n" }] });
    expect(out).toEqual({ a: 1, nested: { ok: "yes" }, list: [{ name: "n" }] });
  });
  it("leaves plain values and verification codes alone", () => {
    expect(stripSecrets("text")).toBe("text");
    expect(stripSecrets({ googleVerification: "abc123", ga4Id: "G-1" })).toEqual({ googleVerification: "abc123", ga4Id: "G-1" });
  });
});

describe("exportFilename", () => {
  it("includes the date", () => {
    expect(exportFilename(new Date("2026-11-08T12:00:00Z"))).toBe("lazyai-settings-2026-11-08.json");
  });
});
