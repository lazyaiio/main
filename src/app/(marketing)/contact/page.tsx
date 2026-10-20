import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/marketing/placeholder-page";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <PlaceholderPage
      title="Contact"
      body="Contact details will be published here before launch."
      cta={{ label: "Back to home", href: "/" }}
    />
  );
}
