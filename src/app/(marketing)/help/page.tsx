import type { Metadata } from "next";
import { SitePage } from "@/components/marketing/site-page";

export const metadata: Metadata = {
  title: "Help",
  description: "How to connect a Facebook Page, create posts, schedule them, and fix common problems.",
};

// The text comes from Admin -> Pages (or the built-in text), so the page is built on request.
export const dynamic = "force-dynamic";

export default function Page() {
  return <SitePage slug="help" showUpdated={false} showToc />;
}
