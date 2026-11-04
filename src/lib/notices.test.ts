import { describe, expect, it } from "vitest";
import { DEFAULT_MAINTENANCE_MESSAGE, DEFAULT_NOTICE, isSafeNoticeLink, noticeKey, normalizeNotice, parseNoticeForm } from "./notices";

const form = {
  announcementEnabled: true,
  text: "New: schedule posts to two Pages at once.",
  tone: "info",
  linkLabel: "Learn more",
  linkUrl: "/pricing",
  maintenanceEnabled: false,
  message: "",
};

describe("isSafeNoticeLink", () => {
  it("allows site paths and https addresses only", () => {
    for (const ok of ["", "/", "/pricing", "/blog/how-to?x=1#top", "https://example.com/news"]) expect(isSafeNoticeLink(ok)).toBe(true);
    for (const bad of ["//evil.com", "http://example.com", "javascript:alert(1)", "data:text/html,hi", "ftp://x.com", "pricing", "/a b", "https://user:pw@example.com", "https://localhost", `/${"a".repeat(250)}`]) {
      expect(isSafeNoticeLink(bad)).toBe(false);
    }
  });
});

describe("normalizeNotice", () => {
  it("returns the defaults for anything that is not an object", () => {
    for (const v of [null, undefined, 5, "x", []]) expect(normalizeNotice(v)).toEqual(DEFAULT_NOTICE);
  });

  it("never shows an empty banner, an unsafe link, or an unknown color", () => {
    const n = normalizeNotice({ announcement: { enabled: true, text: "  ", tone: "pink", linkUrl: "javascript:x", linkLabel: "Go" } });
    expect(n.announcement.enabled).toBe(false);
    expect(n.announcement.tone).toBe("info");
    expect(n.announcement.linkUrl).toBe("");
    expect(n.announcement.linkLabel).toBe("");
  });

  it("keeps good values and trims long ones", () => {
    const n = normalizeNotice({ announcement: { enabled: true, text: "Hello", tone: "warning", linkUrl: "/pricing", linkLabel: "See plans" }, maintenance: { enabled: true, message: "m".repeat(500) } });
    expect(n.announcement).toEqual({ enabled: true, text: "Hello", tone: "warning", linkLabel: "See plans", linkUrl: "/pricing" });
    expect(n.maintenance.enabled).toBe(true);
    expect(n.maintenance.message).toHaveLength(300);
  });

  it("uses the default maintenance message when none is stored", () => {
    expect(normalizeNotice({ maintenance: { enabled: true } }).maintenance.message).toBe(DEFAULT_MAINTENANCE_MESSAGE);
  });
});

describe("parseNoticeForm", () => {
  it("accepts a good form", () => {
    const r = parseNoticeForm(form);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.announcement.enabled).toBe(true);
      expect(r.value.maintenance.message).toBe(DEFAULT_MAINTENANCE_MESSAGE);
    }
  });

  it("rejects Bengali text and markup (English only, plain text only)", () => {
    const bengali = "\u0986\u09ae\u09be\u09a6\u09c7\u09b0 \u09a8\u09a4\u09c1\u09a8 \u09ab\u09bf\u099a\u09be\u09b0";
    const r1 = parseNoticeForm({ ...form, text: bengali });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toMatch(/English/);
    expect(parseNoticeForm({ ...form, message: bengali }).ok).toBe(false);
    expect(parseNoticeForm({ ...form, text: "Hi <b>there</b>" }).ok).toBe(false);
  });

  it("explains every other problem", () => {
    const msg = (patch: Record<string, unknown>) => {
      const r = parseNoticeForm({ ...form, ...patch });
      return r.ok ? "" : r.error;
    };
    expect(msg({ text: "" })).toMatch(/Write the banner text/);
    expect(msg({ text: "x".repeat(200) })).toMatch(/160/);
    expect(msg({ linkUrl: "http://example.com" })).toMatch(/https/);
    expect(msg({ linkLabel: "" })).toMatch(/label/);
    expect(msg({ linkUrl: "", linkLabel: "Learn more" })).toMatch(/address/);
    expect(msg({ tone: "purple" })).toMatch(/color/);
    expect(msg({ message: "m".repeat(400) })).toMatch(/300/);
  });

  it("lets an admin save a switched-off banner with no text", () => {
    expect(parseNoticeForm({ ...form, announcementEnabled: false, text: "", linkUrl: "", linkLabel: "" }).ok).toBe(true);
  });
});

describe("noticeKey", () => {
  it("changes when the text changes and stays the same otherwise", () => {
    expect(noticeKey("a")).toBe(noticeKey("a"));
    expect(noticeKey("a")).not.toBe(noticeKey("b"));
  });
});
