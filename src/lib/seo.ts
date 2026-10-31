import { siteConfig } from "./site";
import { BENGALI } from "./site-pages";

/**
 * Search engine settings. Pure code (no database): defaults, cleaning of what an admin types, the page-by-page
 * built-in titles, structured data, and the health check shown in Admin -> SEO.
 */

export type SeoSettings = {
  allowIndexing: boolean;
  titleTemplate: string;
  defaultTitle: string;
  defaultDescription: string;
  ogImageUrl: string;
  twitterHandle: string;
  orgName: string;
  orgLogoUrl: string;
  sameAs: string[];
  verification: { google: string; bing: string; yandex: string; pinterest: string; baidu: string; facebook: string };
  customMeta: { name: string; content: string }[];
  tracking: { ga4: string; gtm: string; metaPixel: string; clarity: string };
  blockAiCrawlers: boolean;
  robotsExtra: string[];
};

export const DEFAULT_SEO: SeoSettings = {
  allowIndexing: true,
  titleTemplate: `%s · ${siteConfig.name}`,
  defaultTitle: `${siteConfig.name}: ${siteConfig.tagline}`,
  defaultDescription: siteConfig.description,
  ogImageUrl: "",
  twitterHandle: "",
  orgName: siteConfig.name,
  orgLogoUrl: "",
  sameAs: [],
  verification: { google: "", bing: "", yandex: "", pinterest: "", baidu: "", facebook: "" },
  customMeta: [],
  tracking: { ga4: "", gtm: "", metaPixel: "", clarity: "" },
  blockAiCrawlers: false,
  robotsExtra: [],
};

/** The public pages with their built-in search titles and descriptions. */
export const SEO_PAGES = [
  { path: "/", label: "Home", title: "", description: "" },
  { path: "/pricing", label: "Pricing", title: "Pricing", description: "Simple plans for planning, writing, and scheduling Facebook Page posts with AI. Start free and upgrade when you need more." },
  { path: "/about", label: "About", title: "About", description: "What LazyAI does and who runs it." },
  { path: "/help", label: "Help", title: "Help", description: "How to connect a Facebook Page, create posts, schedule them, and fix common problems." },
  { path: "/contact", label: "Contact", title: "Contact", description: "How to reach LazyAI for support, privacy requests, and security reports." },
  { path: "/privacy", label: "Privacy Policy", title: "Privacy Policy", description: "How LazyAI collects, uses, shares, and protects your information, including Facebook Page data." },
  { path: "/terms", label: "Terms of Service", title: "Terms of Service", description: "The rules for using LazyAI, including AI-generated content and publishing to Facebook Pages." },
  { path: "/acceptable-use", label: "Acceptable Use Policy", title: "Acceptable Use Policy", description: "What you may and may not do with LazyAI, including the content you create and publish." },
  { path: "/cookies", label: "Cookie Notice", title: "Cookie Notice", description: "The cookies LazyAI uses, and how optional analytics are only turned on with your consent." },
  { path: "/data-deletion", label: "Data Deletion", title: "Data Deletion", description: "How to delete your LazyAI data and your Facebook connection data." },
] as const;

export type SeoPagePath = (typeof SEO_PAGES)[number]["path"];
export const isSeoPath = (v: unknown): v is SeoPagePath => SEO_PAGES.some((p) => p.path === v);

export type PageSeoOverride = { title: string; description: string; ogImage: string; noindex: boolean };
export const EMPTY_OVERRIDE: PageSeoOverride = { title: "", description: "", ogImage: "", noindex: false };

// ---------- Cleaning what an admin types ----------
export type Cleaned<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const oneLine = (v: string) => v.replace(/\s+/g, " ").trim();

export function isHttpsUrl(v: string): boolean {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

const englishOnly = (...parts: string[]) => !BENGALI.test(parts.join(" "));

export type SiteFields = Pick<SeoSettings, "allowIndexing" | "titleTemplate" | "defaultTitle" | "defaultDescription" | "ogImageUrl" | "twitterHandle" | "orgName" | "orgLogoUrl" | "sameAs" | "blockAiCrawlers" | "robotsExtra">;

export function cleanSiteFields(input: { allowIndexing: boolean; titleTemplate: string; defaultTitle: string; defaultDescription: string; ogImageUrl: string; twitterHandle: string; orgName: string; orgLogoUrl: string; sameAs: string; blockAiCrawlers: boolean; robotsExtra: string }): Cleaned<SiteFields> {
  const titleTemplate = oneLine(input.titleTemplate) || DEFAULT_SEO.titleTemplate;
  if (!titleTemplate.includes("%s") || titleTemplate.length > 60) return fail("The title pattern must contain %s (where the page title goes) and be at most 60 characters.");
  const defaultTitle = oneLine(input.defaultTitle);
  if (defaultTitle.length < 5 || defaultTitle.length > 70) return fail("The home page title must be 5 to 70 characters.");
  const defaultDescription = oneLine(input.defaultDescription);
  if (defaultDescription.length < 20 || defaultDescription.length > 200) return fail("The site description must be 20 to 200 characters.");
  const ogImageUrl = input.ogImageUrl.trim();
  if (ogImageUrl && (!isHttpsUrl(ogImageUrl) || ogImageUrl.length > 300)) return fail("The share image must be a full https:// address.");
  const handle = input.twitterHandle.trim().replace(/^@/, "");
  if (handle && !/^[A-Za-z0-9_]{1,15}$/.test(handle)) return fail("The X (Twitter) name can have letters, numbers and underscores, up to 15 characters.");
  const orgName = oneLine(input.orgName) || siteConfig.name;
  if (orgName.length > 80) return fail("The organization name is too long.");
  const orgLogoUrl = input.orgLogoUrl.trim();
  if (orgLogoUrl && (!isHttpsUrl(orgLogoUrl) || orgLogoUrl.length > 300)) return fail("The logo must be a full https:// address.");
  const sameAs = input.sameAs.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (sameAs.length > 10 || sameAs.some((u) => !isHttpsUrl(u) || u.length > 300)) return fail("Social profile links must be full https:// addresses, one per line, at most 10.");
  const robotsExtra = input.robotsExtra.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (robotsExtra.length > 20 || robotsExtra.some((p) => !/^\/[A-Za-z0-9/_\-.*]{0,100}$/.test(p))) return fail("Extra robots rules must be paths that start with /, one per line, at most 20.");
  if (!englishOnly(titleTemplate, defaultTitle, defaultDescription, orgName, ...sameAs)) return fail("The site text must be in English. Remove the Bengali characters.");
  return { ok: true, value: { allowIndexing: input.allowIndexing, titleTemplate, defaultTitle, defaultDescription, ogImageUrl, twitterHandle: handle, orgName, orgLogoUrl, sameAs, blockAiCrawlers: input.blockAiCrawlers, robotsExtra } };
}

/** People paste the whole <meta ... content="..."> tag. Take just the value out of it. */
export function extractVerificationValue(raw: string): string {
  const text = raw.trim();
  const m = /content\s*=\s*["']([^"']+)["']/i.exec(text);
  return (m ? (m[1] as string) : text).trim();
}

const TOKEN = /^[A-Za-z0-9_\-:.=]{5,200}$/;

export function cleanVerification(input: Record<keyof SeoSettings["verification"], string>, customLines: string): Cleaned<{ verification: SeoSettings["verification"]; customMeta: SeoSettings["customMeta"] }> {
  const verification = { ...DEFAULT_SEO.verification };
  for (const key of Object.keys(verification) as (keyof SeoSettings["verification"])[]) {
    const value = extractVerificationValue(input[key] ?? "");
    if (value && !TOKEN.test(value)) return fail(`The ${key} verification value looks wrong. Paste only the code, or the whole meta tag.`);
    verification[key] = value;
  }
  const customMeta: SeoSettings["customMeta"] = [];
  for (const line of customLines.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const i = line.indexOf("|");
    const name = i < 0 ? "" : line.slice(0, i).trim();
    const content = i < 0 ? "" : extractVerificationValue(line.slice(i + 1));
    if (!/^[A-Za-z0-9_.:-]{2,60}$/.test(name) || !TOKEN.test(content)) return fail("Other tags must be written as: name | value, one per line (for example: naver-site-verification | abc123).");
    customMeta.push({ name, content });
  }
  if (customMeta.length > 10) return fail("At most 10 other tags.");
  return { ok: true, value: { verification, customMeta } };
}

export function cleanTracking(input: SeoSettings["tracking"]): Cleaned<SeoSettings["tracking"]> {
  const t = { ga4: input.ga4.trim().toUpperCase(), gtm: input.gtm.trim().toUpperCase(), metaPixel: input.metaPixel.trim(), clarity: input.clarity.trim().toLowerCase() };
  if (t.ga4 && !/^G-[A-Z0-9]{6,14}$/.test(t.ga4)) return fail("A Google Analytics 4 ID looks like G-XXXXXXXXXX.");
  if (t.gtm && !/^GTM-[A-Z0-9]{4,10}$/.test(t.gtm)) return fail("A Google Tag Manager ID looks like GTM-XXXXXXX.");
  if (t.metaPixel && !/^\d{8,20}$/.test(t.metaPixel)) return fail("A Meta Pixel ID is a number of 8 to 20 digits.");
  if (t.clarity && !/^[a-z0-9]{8,12}$/.test(t.clarity)) return fail("A Microsoft Clarity project ID is 8 to 12 letters and numbers.");
  return { ok: true, value: t };
}

export function cleanPageOverride(input: PageSeoOverride): Cleaned<PageSeoOverride> {
  const title = oneLine(input.title);
  const description = oneLine(input.description);
  const ogImage = input.ogImage.trim();
  if (title.length > 90) return fail("The title can be up to 90 characters.");
  if (description.length > 220) return fail("The description can be up to 220 characters.");
  if (ogImage && (!isHttpsUrl(ogImage) || ogImage.length > 300)) return fail("The share image must be a full https:// address.");
  if (!englishOnly(title, description)) return fail("The text must be in English. Remove the Bengali characters.");
  return { ok: true, value: { title, description, ogImage, noindex: input.noindex } };
}

export function hasTracking(t: SeoSettings["tracking"]): boolean {
  return Boolean(t.ga4 || t.gtm || t.metaPixel || t.clarity);
}

/** Merges what was saved with the defaults, so missing or broken parts never break the site. */
export function normalizeSeo(raw: unknown): SeoSettings {
  const d = DEFAULT_SEO;
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, fallback: string, max = 300) => (typeof v === "string" ? v.slice(0, max) : fallback);
  const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
  const ver = obj(r.verification);
  const trk = obj(r.tracking);
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : []);
  return {
    allowIndexing: r.allowIndexing === false ? false : true,
    titleTemplate: typeof r.titleTemplate === "string" && r.titleTemplate.includes("%s") ? r.titleTemplate.slice(0, 60) : d.titleTemplate,
    defaultTitle: str(r.defaultTitle, d.defaultTitle, 70) || d.defaultTitle,
    defaultDescription: str(r.defaultDescription, d.defaultDescription, 200) || d.defaultDescription,
    ogImageUrl: str(r.ogImageUrl, ""),
    twitterHandle: str(r.twitterHandle, "", 15),
    orgName: str(r.orgName, d.orgName, 80) || d.orgName,
    orgLogoUrl: str(r.orgLogoUrl, ""),
    sameAs: list(r.sameAs, 10),
    verification: {
      google: str(ver.google, "", 200), bing: str(ver.bing, "", 200), yandex: str(ver.yandex, "", 200),
      pinterest: str(ver.pinterest, "", 200), baidu: str(ver.baidu, "", 200), facebook: str(ver.facebook, "", 200),
    },
    customMeta: (Array.isArray(r.customMeta) ? r.customMeta : []).slice(0, 10).filter((m): m is { name: string; content: string } => !!m && typeof (m as { name?: unknown }).name === "string" && typeof (m as { content?: unknown }).content === "string"),
    tracking: { ga4: str(trk.ga4, "", 20), gtm: str(trk.gtm, "", 20), metaPixel: str(trk.metaPixel, "", 20), clarity: str(trk.clarity, "", 12) },
    blockAiCrawlers: r.blockAiCrawlers === true,
    robotsExtra: list(r.robotsExtra, 20),
  };
}

// ---------- The title a visitor will see ----------
export function finalTitle(template: string, title: string): string {
  return template.replace("%s", title);
}

export function effectiveSeo(path: SeoPagePath, settings: SeoSettings, override: PageSeoOverride | null) {
  const page = SEO_PAGES.find((p) => p.path === path) as (typeof SEO_PAGES)[number];
  const isHome = path === "/";
  const title = override?.title || (isHome ? settings.defaultTitle : page.title);
  const description = override?.description || (isHome ? settings.defaultDescription : page.description);
  return {
    title,
    description,
    shownTitle: isHome || override?.title === settings.defaultTitle ? title : finalTitle(settings.titleTemplate, title),
    ogImage: override?.ogImage || settings.ogImageUrl || "",
    noindex: !settings.allowIndexing || Boolean(override?.noindex),
  };
}

// ---------- Structured data (JSON-LD) ----------
export function organizationLd(base: string, s: SeoSettings) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${base}/#organization`, name: s.orgName, url: base, ...(s.orgLogoUrl ? { logo: s.orgLogoUrl } : {}), ...(s.sameAs.length > 0 ? { sameAs: s.sameAs } : {}) },
      { "@type": "WebSite", "@id": `${base}/#website`, url: base, name: siteConfig.name, description: s.defaultDescription, inLanguage: "en-US", publisher: { "@id": `${base}/#organization` } },
    ],
  };
}

export function breadcrumbLd(base: string, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...items].map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: `${base}${item.path === "/" ? "" : item.path}` })),
  };
}

export function softwareLd(base: string, s: SeoSettings, plans: { name: string; description: string; price: number; currency: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    url: base,
    description: s.defaultDescription,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: plans.map((p) => ({ "@type": "Offer", name: p.name, description: p.description || undefined, price: p.price.toFixed(2), priceCurrency: p.currency, availability: "https://schema.org/InStock" })),
  };
}

/** Safe to place inside a <script type="application/ld+json"> tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

// ---------- robots.txt ----------
export const PRIVATE_PATHS = ["/app", "/admin", "/api", "/auth", "/onboarding", "/checkout"];
export const AI_TRAINING_BOTS = ["GPTBot", "CCBot", "Google-Extended", "anthropic-ai", "ClaudeBot", "Bytespider", "Applebot-Extended", "cohere-ai", "Meta-ExternalAgent"];

export function robotsRules(s: SeoSettings): { userAgent: string | string[]; allow?: string; disallow?: string | string[] }[] {
  if (!s.allowIndexing) return [{ userAgent: "*", disallow: "/" }];
  const rules: { userAgent: string | string[]; allow?: string; disallow?: string | string[] }[] = [{ userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS, ...s.robotsExtra] }];
  if (s.blockAiCrawlers) rules.push({ userAgent: AI_TRAINING_BOTS, disallow: "/" });
  return rules;
}

// ---------- Health check ----------
export type AuditLevel = "ok" | "warn" | "bad";
export type AuditItem = { level: AuditLevel; label: string; detail: string; group: "Site" | "Pages" | "Search consoles" | "Tracking" };

export function auditSeo(input: { settings: SeoSettings; overrides: Record<string, PageSeoOverride>; appUrl: string }): AuditItem[] {
  const { settings: s, overrides, appUrl } = input;
  const out: AuditItem[] = [];
  const add = (group: AuditItem["group"], level: AuditLevel, label: string, detail: string) => out.push({ group, level, label, detail });

  add("Site", s.allowIndexing ? "ok" : "bad", "Search engines may index the site", s.allowIndexing ? "robots.txt allows the public pages." : "Indexing is switched off. Search engines are told to stay away from the whole site.");
  const host = (() => { try { return new URL(appUrl).hostname; } catch { return ""; } })();
  add("Site", appUrl.startsWith("https://") && !host.endsWith(".vercel.app") && host !== "localhost" ? "ok" : "warn", "Site address", appUrl.startsWith("https://") && !host.endsWith(".vercel.app") ? `Using ${appUrl}.` : `NEXT_PUBLIC_APP_URL is ${appUrl}. Set it to your real https domain so links, the sitemap and canonical addresses are right.`);
  const dl = s.defaultDescription.length;
  add("Site", dl >= 70 && dl <= 160 ? "ok" : "warn", "Site description length", `${dl} characters. Search results show about 70 to 160.`);
  add("Site", s.ogImageUrl ? "ok" : "warn", "Share image", s.ogImageUrl ? "A share image address is set." : "Using the built-in share image. Add a 1200 by 630 image address for a custom one.");
  add("Site", s.orgLogoUrl ? "ok" : "warn", "Organization logo", s.orgLogoUrl ? "Set (used in structured data)." : "Add a logo address so search engines can show your logo.");
  add("Site", s.sameAs.length > 0 ? "ok" : "warn", "Social profile links", s.sameAs.length > 0 ? `${s.sameAs.length} linked.` : "Add your Facebook Page and other profiles to help search engines connect them to the site.");

  for (const page of SEO_PAGES) {
    const eff = effectiveSeo(page.path, s, overrides[page.path] ?? null);
    const len = eff.shownTitle.length;
    const descLen = eff.description.length;
    if (eff.noindex) {
      add("Pages", "ok", `${page.label}: not indexed`, "Hidden from search engines and left out of the sitemap.");
      continue;
    }
    add("Pages", len >= 15 && len <= 60 ? "ok" : "warn", `${page.label}: title`, `"${eff.shownTitle}" is ${len} characters. Aim for about 15 to 60.`);
    add("Pages", descLen >= 70 && descLen <= 160 ? "ok" : "warn", `${page.label}: description`, `${descLen} characters. Aim for about 70 to 160.`);
  }

  const v = s.verification;
  add("Search consoles", v.google ? "ok" : "warn", "Google Search Console", v.google ? "Verification tag added." : "Not verified. Verify the site to see how Google finds it and to submit the sitemap.");
  add("Search consoles", v.bing ? "ok" : "warn", "Bing Webmaster Tools", v.bing ? "Verification tag added." : "Not verified. Bing also powers other search engines and some AI assistants.");
  add("Search consoles", v.yandex || v.baidu || v.pinterest || v.facebook ? "ok" : "warn", "Other verifications", [v.yandex && "Yandex", v.baidu && "Baidu", v.pinterest && "Pinterest", v.facebook && "Facebook domain"].filter(Boolean).join(", ") || "None added (optional).");

  const t = s.tracking;
  add("Tracking", hasTracking(t) ? "ok" : "warn", "Analytics or ad tags", hasTracking(t) ? "Added. They load only after a visitor accepts the cookie banner." : "None added (optional). The site has its own cookie-free statistics in Admin, Analytics.");
  return out;
}
