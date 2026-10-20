import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/marketing/placeholder-page";

export const metadata: Metadata = { title: "Privacy", robots: { index: false } };

export default function PrivacyPage() {
  return (
    <PlaceholderPage
      title="Privacy policy"
      body="Our privacy policy is being prepared and will be published here before public launch."
      cta={{ label: "Back to home", href: "/" }}
    />
  );
}
