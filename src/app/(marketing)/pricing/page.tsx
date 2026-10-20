import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/marketing/placeholder-page";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <PlaceholderPage
      title="Pricing is coming soon"
      body="We are finalising simple plans. Pricing will be announced before launch, and you will always know what you are paying for."
      cta={{ label: "Contact us", href: "/contact" }}
    />
  );
}
