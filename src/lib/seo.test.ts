import { describe, expect, it } from "vitest";
import { DEFAULT_SEO, SEO_PAGES, auditSeo, breadcrumbLd, cleanPageOverride, cleanSiteFields, cleanTracking, cleanVerification, effectiveSeo, extractVerificationValue, hasTracking, jsonLdString, normalizeSeo, organizationLd, robotsRules, softwareLd } from "./seo";

const site = { allowIndexing: true, titleTemplate: "%s | LazyAI", defaultTitle: "LazyAI: Work less. Publish more.", defaultDescription: "Give LazyAI a topic or website and get a content plan and posts for your Facebook Page.", ogImageUrl: "", twitterHandle: "@lazyai", orgName: "LazyAI", orgLogoUrl: "", sameAs: "https://www.facebook.com/lazyai", blockAiCrawlers: false, robotsExtra: "/private\n/tmp/*" };

describe("cleanSiteFields", () => {
  it("accepts good values and trims the handle", () => {
    const r = cleanSiteFields(site);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.twitterHandle).toBe("lazyai");
      expect(r.value.sameAs).toEqual(["https://www.facebook.com/lazyai"]);
      expect(r.value.robotsExtra).toEqual(["/private", "/tmp/*"]);
    }
  });
  it("needs %s in the title pattern", () => {
    expect(cleanSiteFields({ ...site, titleTemplate: "LazyAI" }).ok).toBe(false);
  });
  it("refuses http addresses, bad robots paths and Bengali text", () => {
    expect(cleanSiteFields({ ...site, ogImageUrl: "http://x.com/a.png" }).ok).toBe(false);
    expect(cleanSiteFields({ ...site, sameAs: "javascript:alert(1)" }).ok).toBe(false);
    expect(cleanSiteFields({ ...site, robotsExtra: "no-slash" }).ok).toBe(false);
    expect(cleanSiteFields({ ...site, defaultDescription: `${site.defaultDescription} \u0995\u0996` }).ok).toBe(false);
  });
  it("limits the lengths", () => {
    expect(cleanSiteFields({ ...site, defaultTitle: "x".repeat(80) }).ok).toBe(false);
    expect(cleanSiteFields({ ...site, defaultDescription: "short" }).ok).toBe(false);
  });
});

describe("verification", () => {
  it("pulls the value out of a pasted meta tag", () => {
    expect(extractVerificationValue('<meta name="google-site-verification" content="abc123-XYZ_9" />')).toBe("abc123-XYZ_9");
    expect(extractVerificationValue("  plainvalue123 ")).toBe("plainvalue123");
  });
  it("cleans the six fields and other tags", () => {
    const empty = { google: "", bing: "", yandex: "", pinterest: "", baidu: "", facebook: "" };
    const r = cleanVerification({ ...empty, google: '<meta name="google-site-verification" content="g_token-123">', bing: "ABCDEF0123456789" }, "naver-site-verification | n_token_123\n");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.verification.google).toBe("g_token-123");
      expect(r.value.customMeta).toEqual([{ name: "naver-site-verification", content: "n_token_123" }]);
    }
  });
  it("refuses values that could break out of an attribute", () => {
    const empty = { google: "", bing: "", yandex: "", pinterest: "", baidu: "", facebook: "" };
    expect(cleanVerification({ ...empty, google: 'abc"><script>' }, "").ok).toBe(false);
    expect(cleanVerification(empty, "bad line without separator").ok).toBe(false);
  });
});

describe("cleanTracking", () => {
  it("accepts real-looking ids and normalizes case", () => {
    const r = cleanTracking({ ga4: "g-abcd123456", gtm: "gtm-ab12cd3", metaPixel: "123456789012345", clarity: "ABCDEFGH12" });
    expect(r).toEqual({ ok: true, value: { ga4: "G-ABCD123456", gtm: "GTM-AB12CD3", metaPixel: "123456789012345", clarity: "abcdefgh12" } });
  });
  it("refuses anything else, so nothing can be injected into the loader code", () => {
    expect(cleanTracking({ ga4: "G-1');alert(1);//", gtm: "", metaPixel: "", clarity: "" }).ok).toBe(false);
    expect(cleanTracking({ ga4: "", gtm: "", metaPixel: "12ab", clarity: "" }).ok).toBe(false);
  });
  it("detects whether any tag is set", () => {
    expect(hasTracking(DEFAULT_SEO.tracking)).toBe(false);
    expect(hasTracking({ ...DEFAULT_SEO.tracking, gtm: "GTM-ABCD" })).toBe(true);
  });
});

describe("page settings", () => {
  it("uses the built-in text unless the admin overrides it", () => {
    const base = effectiveSeo("/pricing", DEFAULT_SEO, null);
    expect(base.title).toBe("Pricing");
    expect(base.shownTitle).toBe("Pricing · LazyAI");
    const custom = effectiveSeo("/pricing", DEFAULT_SEO, { title: "Plans and prices", description: "", ogImage: "", noindex: false });
    expect(custom.shownTitle).toBe("Plans and prices · LazyAI");
    expect(custom.description).toBe(base.description);
  });
  it("shows the home title as it is, and honors noindex and the master switch", () => {
    expect(effectiveSeo("/", DEFAULT_SEO, null).shownTitle).toBe(DEFAULT_SEO.defaultTitle);
    expect(effectiveSeo("/about", DEFAULT_SEO, { title: "", description: "", ogImage: "", noindex: true }).noindex).toBe(true);
    expect(effectiveSeo("/about", { ...DEFAULT_SEO, allowIndexing: false }, null).noindex).toBe(true);
  });
  it("cleans overrides", () => {
    expect(cleanPageOverride({ title: " A  B ", description: "", ogImage: "", noindex: false })).toEqual({ ok: true, value: { title: "A B", description: "", ogImage: "", noindex: false } });
    expect(cleanPageOverride({ title: "x".repeat(100), description: "", ogImage: "", noindex: false }).ok).toBe(false);
    expect(cleanPageOverride({ title: "", description: "", ogImage: "http://a.com/x.png", noindex: false }).ok).toBe(false);
  });
});

describe("normalizeSeo", () => {
  it("falls back to the defaults for empty or broken data", () => {
    expect(normalizeSeo(null)).toEqual(DEFAULT_SEO);
    expect(normalizeSeo({ titleTemplate: "no placeholder", sameAs: "x", tracking: 5 })).toEqual(DEFAULT_SEO);
  });
  it("keeps valid saved values", () => {
    const s = normalizeSeo({ allowIndexing: false, blockAiCrawlers: true, tracking: { ga4: "G-ABCD123456" } });
    expect(s.allowIndexing).toBe(false);
    expect(s.blockAiCrawlers).toBe(true);
    expect(s.tracking.ga4).toBe("G-ABCD123456");
  });
});

describe("structured data", () => {
  it("describes the organization and the website", () => {
    const ld = organizationLd("https://lazyai.io", { ...DEFAULT_SEO, orgLogoUrl: "https://lazyai.io/logo.png", sameAs: ["https://www.facebook.com/lazyai"] });
    const text = JSON.stringify(ld);
    expect(text).toContain('"@type":"Organization"');
    expect(text).toContain('"@type":"WebSite"');
    expect(text).toContain("facebook.com/lazyai");
  });
  it("builds breadcrumbs with absolute addresses", () => {
    const ld = breadcrumbLd("https://lazyai.io", [{ name: "Pricing", path: "/pricing" }]);
    expect(ld.itemListElement.map((i) => i.item)).toEqual(["https://lazyai.io", "https://lazyai.io/pricing"]);
  });
  it("lists the plans as offers", () => {
    const ld = softwareLd("https://lazyai.io", DEFAULT_SEO, [{ name: "Pro", description: "", price: 500, currency: "BDT" }]);
    expect(ld.offers[0]).toMatchObject({ price: "500.00", priceCurrency: "BDT" });
  });
  it("cannot close the script tag", () => {
    expect(jsonLdString({ a: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});

describe("robots rules", () => {
  it("blocks private areas and keeps the public site open", () => {
    const rules = robotsRules({ ...DEFAULT_SEO, robotsExtra: ["/draft"] });
    expect(rules).toHaveLength(1);
    expect(rules[0]?.allow).toBe("/");
    expect(rules[0]?.disallow).toContain("/admin");
    expect(rules[0]?.disallow).toContain("/draft");
  });
  it("blocks everything when indexing is off", () => {
    expect(robotsRules({ ...DEFAULT_SEO, allowIndexing: false })).toEqual([{ userAgent: "*", disallow: "/" }]);
  });
  it("can turn away AI training crawlers", () => {
    const rules = robotsRules({ ...DEFAULT_SEO, blockAiCrawlers: true });
    expect(rules).toHaveLength(2);
    expect(rules[1]?.userAgent).toContain("GPTBot");
  });
});

describe("auditSeo", () => {
  const audit = (settings = DEFAULT_SEO, appUrl = "https://lazyai.io") => auditSeo({ settings, overrides: {}, appUrl });
  it("checks every public page for a title and a description", () => {
    const items = audit().filter((i) => i.group === "Pages");
    expect(items.length).toBe(SEO_PAGES.length * 2);
  });
  it("warns about a vercel.app address and missing consoles", () => {
    const items = audit(DEFAULT_SEO, "https://lazyai.vercel.app");
    expect(items.find((i) => i.label === "Site address")?.level).toBe("warn");
    expect(items.find((i) => i.label === "Google Search Console")?.level).toBe("warn");
  });
  it("is happy with a verified site", () => {
    const items = audit({ ...DEFAULT_SEO, verification: { ...DEFAULT_SEO.verification, google: "tokentoken1" } });
    expect(items.find((i) => i.label === "Google Search Console")?.level).toBe("ok");
    expect(audit().find((i) => i.label === "Site address")?.level).toBe("ok");
  });
  it("shows a bad mark when indexing is off", () => {
    expect(audit({ ...DEFAULT_SEO, allowIndexing: false }).find((i) => i.label === "Search engines may index the site")?.level).toBe("bad");
  });
});
