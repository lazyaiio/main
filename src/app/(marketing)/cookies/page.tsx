import type { Metadata } from "next";
import { SitePage } from "@/components/marketing/site-page";

export const metadata: Metadata = {
  title: "Cookie Notice",
  description: "The cookies LazyAI uses. Today only strictly necessary cookies are used.",
};

// The text comes from Admin -> Pages (or the built-in text), so the page is built on request.
export const dynamic = "force-dynamic";

export default function Page() {
  return <SitePage slug="cookies" />;
}
