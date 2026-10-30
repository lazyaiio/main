import type { Metadata } from "next";
import { SitePage } from "@/components/marketing/site-page";

export const metadata: Metadata = {
  title: "Data Deletion",
  description: "How to delete your LazyAI data and your Facebook connection data.",
};

// The text comes from Admin -> Pages (or the built-in text), so the page is built on request.
export const dynamic = "force-dynamic";

export default function Page() {
  return <SitePage slug="data-deletion" />;
}
