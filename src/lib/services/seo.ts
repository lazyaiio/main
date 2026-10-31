import "server-only";
import type { Metadata } from "next";
import { getPublicEnv } from "@/lib/env";
import { readPageOverrides, readSeoSettings } from "@/lib/data/seo";
import { DEFAULT_SEO, effectiveSeo, isSeoPath, type PageSeoOverride, type SeoPagePath, type SeoSettings } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

/** Settings are read at most once a minute per server instance (saving in Admin clears this instance at once). */
let cache: { at: number; settings: SeoSettings; overrides: Record<string, PageSeoOverride> } | null = null;

export async function loadSeo(): Promise<{ settings: SeoSettings; overrides: Record<string, PageSeoOverride> }> {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  const [settings, overrides] = await Promise.all([readSeoSettings(), readPageOverrides()]);
  cache = { at: Date.now(), settings, overrides };
  return cache;
}

export function forgetSeoCache() {
  cache = null;
}

export const siteBase = () => getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

/** The site-wide metadata: address, title pattern, description, share cards, search console tags, and the master "index or not" switch. */
export async function rootMetadata(): Promise<Metadata> {
  const { settings: s } = await loadSeo().catch(() => ({ settings: DEFAULT_SEO, overrides: {} }));
  const base = siteBase();
  const images = s.ogImageUrl ? [{ url: s.ogImageUrl }] : undefined;
  const other: Record<string, string> = {};
  if (s.verification.bing) other["msvalidate.01"] = s.verification.bing;
  if (s.verification.pinterest) other["p:domain_verify"] = s.verification.pinterest;
  if (s.verification.baidu) other["baidu-site-verification"] = s.verification.baidu;
  if (s.verification.facebook) other["facebook-domain-verification"] = s.verification.facebook;
  for (const m of s.customMeta) other[m.name] = m.content;
  return {
    metadataBase: new URL(base),
    title: { default: s.defaultTitle, template: s.titleTemplate },
    description: s.defaultDescription,
    applicationName: siteConfig.name,
    openGraph: { title: s.defaultTitle, description: s.defaultDescription, siteName: siteConfig.name, type: "website", locale: "en_US", ...(images ? { images } : {}) },
    twitter: { card: "summary_large_image", title: s.defaultTitle, description: s.defaultDescription, ...(s.twitterHandle ? { site: `@${s.twitterHandle}`, creator: `@${s.twitterHandle}` } : {}), ...(images ? { images: [s.ogImageUrl] } : {}) },
    verification: { ...(s.verification.google ? { google: s.verification.google } : {}), ...(s.verification.yandex ? { yandex: s.verification.yandex } : {}), ...(Object.keys(other).length > 0 ? { other } : {}) },
    ...(s.allowIndexing ? {} : { robots: { index: false, follow: false } }),
  };
}

/** Metadata for one public page: title, description, canonical address, share card, and noindex. */
export async function pageMetadata(path: string): Promise<Metadata> {
  if (!isSeoPath(path)) return {};
  const { settings, overrides } = await loadSeo().catch(() => ({ settings: DEFAULT_SEO, overrides: {} as Record<string, PageSeoOverride> }));
  const eff = effectiveSeo(path as SeoPagePath, settings, overrides[path] ?? null);
  const url = `${siteBase()}${path === "/" ? "" : path}`;
  const image = eff.ogImage ? [{ url: eff.ogImage }] : undefined;
  return {
    title: path === "/" ? { absolute: eff.title } : eff.title,
    description: eff.description,
    alternates: { canonical: url },
    openGraph: { title: eff.shownTitle, description: eff.description, url, siteName: siteConfig.name, type: "website", locale: "en_US", ...(image ? { images: image } : {}) },
    twitter: { card: "summary_large_image", title: eff.shownTitle, description: eff.description, ...(eff.ogImage ? { images: [eff.ogImage] } : {}) },
    ...(eff.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
