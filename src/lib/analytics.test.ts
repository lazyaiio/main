import { describe, expect, it } from "vitest";
import { allowedBuckets, classifySource, cleanUtm, defaultBucket, fillBuckets, isBot, normalizePath, parseUserAgent, percent, resolveRange, utcDay, visitorHash } from "./analytics";

const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";
const FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0";

describe("parseUserAgent", () => {
  it("recognizes common browsers, systems and devices", () => {
    expect(parseUserAgent(CHROME_WIN)).toEqual({ device: "desktop", browser: "Chrome", os: "Windows" });
    expect(parseUserAgent(SAFARI_IPHONE)).toEqual({ device: "mobile", browser: "Safari", os: "iOS" });
    expect(parseUserAgent(ANDROID_CHROME)).toEqual({ device: "mobile", browser: "Chrome", os: "Android" });
    expect(parseUserAgent(IPAD).device).toBe("tablet");
    expect(parseUserAgent(EDGE).browser).toBe("Edge");
    expect(parseUserAgent(FIREFOX)).toEqual({ device: "desktop", browser: "Firefox", os: "Linux" });
  });
});

describe("isBot", () => {
  it("ignores crawlers, tools and empty agents", () => {
    for (const ua of ["Googlebot/2.1 (+http://www.google.com/bot.html)", "curl/8.4.0", "Mozilla/5.0 HeadlessChrome/126", "python-requests/2.31", "", "x"]) expect(isBot(ua)).toBe(true);
  });
  it("keeps real browsers", () => {
    for (const ua of [CHROME_WIN, SAFARI_IPHONE, ANDROID_CHROME, FIREFOX]) expect(isBot(ua)).toBe(false);
  });
});

describe("normalizePath", () => {
  it("drops the query and the trailing slash", () => {
    expect(normalizePath("/pricing/?a=1#x")).toBe("/pricing");
    expect(normalizePath("/")).toBe("/");
  });
  it("skips private areas and odd values", () => {
    for (const p of ["/app", "/app/projects", "/admin/analytics", "/api/x", "/auth/login", "//evil.com", "pricing", 5, "/a b", "/" + "x".repeat(250)]) expect(normalizePath(p)).toBeNull();
  });
});

describe("classifySource", () => {
  const base = { ownHost: "lazyai.io", utmSource: null, utmMedium: null };
  it("calls an empty or own-site referrer direct", () => {
    expect(classifySource({ ...base, referrer: "" }).source).toBe("direct");
    expect(classifySource({ ...base, referrer: "https://www.lazyai.io/pricing" }).source).toBe("direct");
  });
  it("finds search engines and social sites", () => {
    expect(classifySource({ ...base, referrer: "https://www.google.com.bd/" })).toMatchObject({ source: "search", name: "Google" });
    expect(classifySource({ ...base, referrer: "https://l.facebook.com/l.php?u=x" })).toMatchObject({ source: "social", name: "Facebook" });
    expect(classifySource({ ...base, referrer: "https://t.co/abc" })).toMatchObject({ source: "social", name: "X (Twitter)" });
  });
  it("treats other sites as referrals", () => {
    expect(classifySource({ ...base, referrer: "https://blog.example.com/post" })).toMatchObject({ source: "referral", name: "blog.example.com" });
  });
  it("lets campaign links win", () => {
    expect(classifySource({ ...base, referrer: "https://www.google.com/", utmSource: "newsletter", utmMedium: "email" })).toMatchObject({ source: "email", name: "newsletter" });
    expect(classifySource({ ...base, referrer: "", utmSource: "fb", utmMedium: "cpc" }).source).toBe("paid");
  });
});

describe("cleanUtm", () => {
  it("accepts short plain values and lowercases them", () => {
    expect(cleanUtm("Spring_Sale")).toBe("spring_sale");
    expect(cleanUtm("<script>")).toBeNull();
    expect(cleanUtm("x".repeat(80))).toBeNull();
  });
});

describe("visitorHash", () => {
  it("is stable within a day and changes between days, addresses and agents", () => {
    const a = visitorHash("secret", "2026-11-01", "1.2.3.4", CHROME_WIN);
    expect(visitorHash("secret", "2026-11-01", "1.2.3.4", CHROME_WIN)).toBe(a);
    expect(visitorHash("secret", "2026-11-02", "1.2.3.4", CHROME_WIN)).not.toBe(a);
    expect(visitorHash("secret", "2026-11-01", "1.2.3.5", CHROME_WIN)).not.toBe(a);
    expect(visitorHash("other", "2026-11-01", "1.2.3.4", CHROME_WIN)).not.toBe(a);
    expect(a.includes("1.2.3.4")).toBe(false);
    expect(a.length).toBe(32);
  });
  it("formats the day in UTC", () => {
    expect(utcDay(new Date("2026-11-01T23:59:59Z"))).toBe("2026-11-01");
  });
});

describe("ranges and buckets", () => {
  const now = new Date("2026-11-15T10:30:00Z");
  it("computes the usual ranges", () => {
    expect(resolveRange("today", null, now).from.toISOString()).toBe("2026-11-15T00:00:00.000Z");
    expect(resolveRange("7d", null, now).from.toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(resolveRange("yesterday", null, now).to.toISOString()).toBe("2026-11-15T00:00:00.000Z");
    expect(resolveRange("12m", null, now).from.toISOString()).toBe("2025-12-01T00:00:00.000Z");
  });
  it("keeps only sensible buckets", () => {
    expect(resolveRange("today", "year", now).bucket).toBe("hour");
    expect(resolveRange("30d", "week", now).bucket).toBe("week");
    expect(resolveRange("all", "year", now).bucket).toBe("year");
    expect(defaultBucket("90d")).toBe("week");
    expect(allowedBuckets("12m")).toContain("month");
  });
  it("fills empty days with zeros", () => {
    const from = new Date("2026-11-01T00:00:00Z");
    const to = new Date("2026-11-04T00:00:00Z");
    const points = fillBuckets([{ t: "2026-11-02 00:00:00", views: 5, visitors: 3, sessions: 4 }], from, to, "day");
    expect(points.map((p) => p.views)).toEqual([0, 5, 0]);
  });
  it("starts weeks on Monday", () => {
    const points = fillBuckets([], new Date("2026-11-04T00:00:00Z"), new Date("2026-11-12T00:00:00Z"), "week");
    expect(points[0]?.t).toBe("2026-11-02T00:00:00.000Z");
  });
  it("computes percentages", () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(1, 0)).toBe(0);
  });
});
