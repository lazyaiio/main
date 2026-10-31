import type { MetadataRoute } from "next";
import { robotsRules } from "@/lib/seo";
import { loadSeo, siteBase } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { settings } = await loadSeo();
  return { rules: robotsRules(settings), sitemap: `${siteBase()}/sitemap.xml`, host: siteBase() };
}
