import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description: "What you may and may not do with LazyAI, including the content you create and publish.",
};

export default function AcceptableUsePage() {
  return (
    <LegalPage
      title="Acceptable Use Policy"
      intro="LazyAI helps businesses publish useful content. This policy sets out what is not allowed so the Service stays safe, legal, and useful for everyone."
    >
      <h2>1. Content you must not create or publish</h2>
      <ul>
        <li>Content that is illegal, or that promotes illegal activity or goods.</li>
        <li>Hateful, harassing, threatening, or violent content, and content that targets people for who they are.</li>
        <li>Sexual content involving minors, or any sexual content that Facebook’s rules do not allow.</li>
        <li>Fraud, scams, pyramid or get-rich-quick schemes, fake reviews or testimonials, and misleading health, financial, or legal claims.</li>
        <li>Disinformation, impersonation of people or organizations, and content designed to deceive.</li>
        <li>Content that infringes someone’s copyright, trademark, privacy, or other rights, including images you do not have the right to use.</li>
        <li>Other people’s personal information published without their permission.</li>
        <li>Malware, phishing links, or anything meant to harm devices or steal information.</li>
      </ul>

      <h2>2. How you must use the Service</h2>
      <ul>
        <li>Review every post before approving it. Do not publish AI drafts without checking them.</li>
        <li>Only connect Facebook Pages that you are allowed to manage, and only publish content you are allowed to publish there.</li>
        <li>Follow the Meta Platform Terms, Facebook Community Standards, and any rules that apply to your industry or country.</li>
        <li>Do not use the Service for spam, bulk unsolicited promotion, engagement manipulation, or to evade Facebook’s limits or enforcement.</li>
        <li>Do not use the Service to read pages or content you are not entitled to access, or to bypass paywalls or logins.</li>
        <li>Do not try to break, overload, probe, or reverse engineer the Service, or bypass its usage limits or security.</li>
        <li>Do not share your account in a way that hides who is acting, and do not resell access to the Service without our written permission.</li>
      </ul>

      <h2>3. AI use</h2>
      <ul>
        <li>Do not ask the AI to create content that breaks section 1, or try to make it ignore its safeguards.</li>
        <li>Do not enter passwords, payment card numbers, government ID numbers, or other sensitive personal information into topics, notes, or links.</li>
        <li>You are responsible for facts, claims, and rights in anything you approve. See our <Link href="/terms">Terms of Service</Link>.</li>
      </ul>

      <h2>4. Enforcement</h2>
      <p>
        If something breaks this policy we may remove content, cancel scheduled posts, disconnect Pages, limit features, or suspend or end an account. Where
        appropriate we will tell you why, and we may report illegal activity to the authorities. Facebook may also take its own action on your Page or account.
      </p>

      <h2>5. Reporting a problem</h2>
      <p>
        To report content or behavior that breaks this policy, or a security problem, email <ContactEmail /> with as much detail as you can, such as links and
        screenshots. Please do not publicly share a security problem before we have had a chance to fix it.
      </p>
    </LegalPage>
  );
}
