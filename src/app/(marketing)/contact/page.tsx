import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { contactEmail, operatorName } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach LazyAI for support, privacy requests, and security reports.",
};

export default function ContactPage() {
  const email = contactEmail();
  return (
    <LegalPage title="Contact us" intro="We read every message. Tell us what you need and we will get back to you as soon as we can.">
      <h2>Email</h2>
      {email ? (
        <p>
          <a href={`mailto:${email}`} className="text-lg">
            {email}
          </a>
        </p>
      ) : (
        <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
          The contact email for this site has not been set up yet.
        </p>
      )}

      <h2>What to write about</h2>
      <ul>
        <li>
          <strong>Support:</strong> a problem with your account, a campaign, a post, or a Facebook connection. Include the page you were on and what you saw.
        </li>
        <li>
          <strong>Privacy requests:</strong> access, correction, or deletion of your data. See <Link href="/data-deletion">Data Deletion</Link> for the steps.
        </li>
        <li>
          <strong>Reports:</strong> content or behavior that breaks our <Link href="/acceptable-use">Acceptable Use Policy</Link>, or a security problem. Please
          give us time to fix a security issue before sharing it publicly.
        </li>
        <li>
          <strong>Business questions:</strong> plans, partnerships, and anything else.
        </li>
      </ul>

      <h2>Who we are</h2>
      <p>
        LazyAI is operated by {operatorName()}. Our <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms of Service</Link> explain how we handle
        your information and the rules of the Service.
      </p>
    </LegalPage>
  );
}
