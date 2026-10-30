import type { Metadata } from "next";
import { SitePage } from "@/components/marketing/site-page";

export const metadata: Metadata = {
  title: "About",
  description: "What LazyAI does and who runs it.",
};

export const dynamic = "force-dynamic";

export default function AboutPage() {
  return <SitePage slug="about" showUpdated={false} />;
}
