import type { MetadataRoute } from "next";
import { readPageDates } from "@/lib/data/seo";
import { SEO_PAGES } from "@/lib/seo";
import { loadSeo, siteBase } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

/** Public pages that are open to search engines, with the date each text was last saved when known. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { settings, overrides } = await loadSeo();
  if (!settings.allowIndexing) return [];
  const dates = await readPageDates();
  const base = siteBase();
  return SEO_PAGES.filter((p) => !overrides[p.path]?.noindex).map((p) => {
    const slug = p.path === "/" ? "home" : p.path.slice(1);
    const saved = dates[slug];
    return {
      url: `${base}${p.path === "/" ? "" : p.path}`,
      ...(saved ? { lastModified: new Date(saved) } : {}),
      changeFrequency: p.path === "/" || p.path === "/pricing" ? ("weekly" as const) : ("monthly" as const),
      priority: p.path === "/" ? 1 : p.path === "/pricing" ? 0.9 : ["/privacy", "/terms", "/acceptable-use", "/cookies", "/data-deletion"].includes(p.path) ? 0.3 : 0.6,
    };
  });
}
