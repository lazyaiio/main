import type { Metadata } from "next";
import { SitePage } from "@/components/marketing/site-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach LazyAI for support, privacy requests, and security reports.",
};

// The text comes from Admin -> Pages (or the built-in text), so the page is built on request.
export const dynamic = "force-dynamic";

export default function Page() {
  return <SitePage slug="contact" showUpdated={false} />;
}
