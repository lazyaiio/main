import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage } from "@/components/marketing/legal-page";
import { operatorCountry, operatorName } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using LazyAI, including AI-generated content and publishing to Facebook Pages.",
};

export default function TermsPage() {
  const operator = operatorName();
  const country = operatorCountry();
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms are the agreement between you and LazyAI. Please read them before you use the Service. By creating an account or using the Service, you agree to them."
    >
      <h2>1. Who we are and what these terms cover</h2>
      <p>
        LazyAI is operated by {operator} (“LazyAI”, “we”, “us”). These Terms of Service (“Terms”) apply to the LazyAI website and app (the “Service”). Our{" "}
        <Link href="/privacy">Privacy Policy</Link>, <Link href="/acceptable-use">Acceptable Use Policy</Link>, and <Link href="/cookies">Cookie Notice</Link> are
        part of these Terms. If you use the Service for a business, you confirm that you can accept these Terms for that business.
      </p>

      <h2>2. The Service</h2>
      <p>
        LazyAI helps you plan content, generate posts with artificial intelligence, edit them with your team, and schedule posts to
        Facebook Pages that you connect. We may add, change, or remove features. Some features are in beta and may change or be unavailable at times.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>You must be at least 18 years old and able to form a binding contract.</li>
        <li>Give accurate information and keep your password secure. You are responsible for activity under your account and workspace.</li>
        <li>Tell us promptly at <ContactEmail /> if you suspect unauthorized access.</li>
        <li>Workspace owners and admins decide who can join and what each person can do. They are responsible for the people they invite.</li>
      </ul>

      <h2>4. Facebook Pages and other third-party services</h2>
      <ul>
        <li>
          To publish to a Facebook Page you must be allowed to post on that Page, and you must connect it yourself using Facebook’s own login. You are responsible
          for having the right to publish the content to that Page.
        </li>
        <li>
          LazyAI publishes only posts that you or your team have scheduled, to the Page and at the time you scheduled. You can cancel a scheduled post before it is
          published.
        </li>
        <li>
          Facebook is a service of Meta Platforms. Your use of Facebook, and of any content you publish there, is also subject to Meta’s terms and policies.
          Meta may limit, reject, or remove content or access at its discretion. We do not control Meta and are not responsible for its decisions or outages.
        </li>
        <li>
          Other providers we use (for example AI providers and stock photo sources) have their own terms. We are not responsible for their services.
        </li>
        <li>LazyAI is independent and is not affiliated with or endorsed by Meta.</li>
      </ul>

      <h2>5. AI-generated content</h2>
      <ul>
        <li>Drafts are produced by AI and can be inaccurate, incomplete, outdated, or similar to other content. They are suggestions, not advice.</li>
        <li>
          <strong>You are responsible for reviewing every post before it is published</strong>, including checking facts, prices, claims, links, and images, and for
          making sure it follows the law, Facebook’s rules, and the rights of others.
        </li>
        <li>We do not guarantee that content will perform in any particular way, or that Facebook will accept or show it.</li>
      </ul>

      <h2>6. Your content</h2>
      <ul>
        <li>
          You keep ownership of the content you provide (such as topics, notes, links, and uploaded images) and, as between you and us, of the drafts generated for
          you, to the extent the law allows. AI output may not be protected by copyright in every country.
        </li>
        <li>
          You give us a limited, non-exclusive license to host, copy, process, and transmit your content only as needed to run the Service for you: to store it,
          to send it to AI providers to generate drafts, and to publish it to the Pages you choose.
        </li>
        <li>You confirm that you have the rights needed to give us that content, and that it does not break these Terms or the law.</li>
      </ul>

      <h2>7. Acceptable use</h2>
      <p>
        You agree to follow our <Link href="/acceptable-use">Acceptable Use Policy</Link>. In short: no spam, deception, illegal or harmful content, rights
        violations, or attempts to abuse or break the Service or Facebook’s rules. We may remove content and suspend or end access that breaks these Terms.
      </p>

      <h2>8. Fees</h2>
      <p>
        The Service may currently be offered free of charge or with usage limits. If we introduce paid plans, we will tell you the price and what is included
        before you are charged, and you will not be charged without agreeing to it. Fair-use limits may apply to AI generation, stock photo search, and storage.
      </p>

      <h2>9. Our rights</h2>
      <p>
        The Service, including its software, design, and branding, belongs to us and our licensors. We give you a limited, revocable, non-transferable right to use
        it under these Terms. You may not copy, resell, reverse engineer, or interfere with it, except where the law allows.
      </p>

      <h2>10. Availability and changes</h2>
      <p>
        We work to keep the Service available but do not promise it will be uninterrupted or error-free. Scheduled posts depend on our systems and on Facebook; we
        cannot guarantee exact timing or delivery. We may change or discontinue parts of the Service and will give reasonable notice of significant changes.
      </p>

      <h2>11. Ending your use</h2>
      <p>
        You can stop using the Service at any time, disconnect your Pages, and ask us to delete your account (see our <Link href="/data-deletion">Data Deletion</Link>{" "}
        page). We may suspend or end your access if you break these Terms, if needed to protect the Service or others, or if the law requires. Sections that by
        their nature should continue (for example 5, 6, 12, 13, and 14) continue after your access ends.
      </p>

      <h2>12. Disclaimers</h2>
      <p>
        The Service is provided “as is” and “as available”. To the fullest extent the law allows, we disclaim all warranties, express or implied, including
        merchantability, fitness for a particular purpose, accuracy of AI output, and non-infringement.
      </p>

      <h2>13. Limitation of liability</h2>
      <p>
        To the fullest extent the law allows, LazyAI and its owners, employees, and providers are not liable for indirect, incidental, special, consequential, or
        punitive damages, or for lost profits, revenue, data, goodwill, or business opportunities, arising from your use of the Service, including content
        published to Facebook or actions taken by Meta. Our total liability for any claim relating to the Service is limited to the greater of the amount you paid
        us in the 12 months before the claim or USD 100. Nothing in these Terms limits liability that cannot be limited by law.
      </p>

      <h2>14. Your responsibility</h2>
      <p>
        You agree to defend and compensate us against claims, losses, and costs arising from content you publish through the Service, your breach of these Terms
        or the law, or your violation of anyone’s rights, to the extent the law allows.
      </p>

      <h2>15. Changes to these Terms</h2>
      <p>
        We may update these Terms. We will change the “Last updated” date and, for material changes, give notice in the app or by email before they take effect.
        If you keep using the Service after the changes take effect, you accept them. If you do not agree, stop using the Service.
      </p>

      <h2>16. Governing law and disputes</h2>
      <p>
        {country
          ? `These Terms are governed by the laws of ${country}, without regard to conflict-of-law rules, and the courts of ${country} have jurisdiction, except where the law of your country gives you mandatory rights.`
          : "These Terms are governed by the laws of the country where the operator of the Service is established, without regard to conflict-of-law rules, except where the law of your country gives you mandatory rights."}{" "}
        Please contact us first at <ContactEmail /> so we can try to resolve any concern informally.
      </p>

      <h2>17. Contact</h2>
      <p>
        Questions about these Terms: <ContactEmail />.
      </p>
    </LegalPage>
  );
}
