import type { Metadata } from "next";
import { pageMetadata } from "@/lib/services/seo";
import { SitePage } from "@/components/marketing/site-page";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/about");
}

export const dynamic = "force-dynamic";

export default function AboutPage() {
  return <SitePage slug="about" showUpdated={false} />;
}
