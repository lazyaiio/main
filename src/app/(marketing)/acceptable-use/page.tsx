import type { Metadata } from "next";
import { SitePage } from "@/components/marketing/site-page";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description: "What you may and may not do with LazyAI, including the content you create and publish.",
};

// The text comes from Admin -> Pages (or the built-in text), so the page is built on request.
export const dynamic = "force-dynamic";

export default function Page() {
  return <SitePage slug="acceptable-use" />;
}
