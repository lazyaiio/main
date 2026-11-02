import type { MetadataRoute } from "next";
import { BLOG_CATEGORIES } from "@/lib/blog";
import { listPublishedMeta } from "@/lib/data/blog";
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
  const posts = await listPublishedMeta().catch(() => []);
  const blog: MetadataRoute.Sitemap = [
    ...BLOG_CATEGORIES.filter((c) => posts.some((p) => p.category_slug === c.slug)).map((c) => ({ url: `${base}/blog/category/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: new Date(p.updated_at), changeFrequency: "monthly" as const, priority: p.is_pillar ? 0.8 : 0.7 })),
  ];
  const pages: MetadataRoute.Sitemap = SEO_PAGES.filter((p) => !overrides[p.path]?.noindex).map((p) => {
    const slug = p.path === "/" ? "home" : p.path.slice(1);
    const saved = dates[slug];
    return {
      url: `${base}${p.path === "/" ? "" : p.path}`,
      ...(saved ? { lastModified: new Date(saved) } : {}),
      changeFrequency: p.path === "/" || p.path === "/pricing" || p.path === "/blog" ? ("weekly" as const) : ("monthly" as const),
      priority: p.path === "/" ? 1 : p.path === "/pricing" || p.path === "/blog" || p.path === "/tools" ? 0.9 : p.path.startsWith("/tools/") ? 0.8 : ["/privacy", "/terms", "/acceptable-use", "/cookies", "/data-deletion"].includes(p.path) ? 0.3 : 0.6,
    };
  });
  return [...pages, ...blog];
}
