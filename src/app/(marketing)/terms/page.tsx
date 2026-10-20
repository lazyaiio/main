import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/marketing/placeholder-page";

export const metadata: Metadata = { title: "Terms", robots: { index: false } };

export default function TermsPage() {
  return (
    <PlaceholderPage
      title="Terms of service"
      body="Our terms of service are being prepared and will be published here before public launch."
      cta={{ label: "Back to home", href: "/" }}
    />
  );
}
