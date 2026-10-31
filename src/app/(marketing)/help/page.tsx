import type { Metadata } from "next";
import { pageMetadata } from "@/lib/services/seo";
import { SitePage } from "@/components/marketing/site-page";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/help");
}

// The text comes from Admin -> Pages (or the built-in text), so the page is built on request.
export const dynamic = "force-dynamic";

export default function Page() {
  return <SitePage slug="help" showUpdated={false} showToc />;
}
