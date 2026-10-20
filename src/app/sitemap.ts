import type { MetadataRoute } from "next";
import { getPublicEnv } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getPublicEnv().NEXT_PUBLIC_APP_URL;
  return ["", "/pricing", "/contact"].map((path) => ({ url: `${base}${path}` }));
}
