import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage } from "@/components/marketing/legal-page";
import { DELETION_DAYS, operatorName } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How LazyAI collects, uses, shares, and protects your information, including Facebook Page data.",
};

export default function PrivacyPage() {
  const operator = operatorName();
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what information LazyAI collects, why we collect it, who we share it with, and the choices you have. We wrote it in plain language on purpose."
    >
      <h2>1. Who we are</h2>
      <p>
        LazyAI is an online service that helps you plan, write, review, and schedule social media posts, including posts for Facebook Pages. In this policy,
        “LazyAI”, “we”, “us”, and “our” mean {operator}, the operator of the LazyAI website and app (together, the “Service”). We are the controller of the
        personal information described here. You can reach us at <ContactEmail />.
      </p>

      <h2>2. Information we collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li>
          <strong>Account information:</strong> your email address, display name, and password. Passwords are handled by our authentication provider and stored in
          hashed form. We cannot read your password.
        </li>
        <li>
          <strong>Workspace information:</strong> your workspace name, timezone, language settings, and the people you invite and their roles.
        </li>
        <li>
          <strong>Content you create:</strong> projects, topics, notes, campaign plans, post drafts, edits, approval decisions, and images you upload.
        </li>
        <li>
          <strong>Web page links you submit:</strong> when you give us an article or website link, we fetch the public text of that page and keep the title and
          extracted text in your workspace so we can write original posts about it.
        </li>
        <li>
          <strong>Messages to us:</strong> anything you send when you contact us.
        </li>
      </ul>

      <h3>Information from Facebook (Meta) when you connect a Page</h3>
      <p>When you choose to connect Facebook, we receive from Meta only what is needed to publish for you:</p>
      <ul>
        <li>your Facebook user ID and name;</li>
        <li>the Facebook Pages you manage: Page ID, Page name, category, and what your role on each Page allows you to do;</li>
        <li>the list of permissions you granted;</li>
        <li>an access token for each Page you choose to connect. We store these tokens in encrypted form and never show them to you or to anyone else.</li>
      </ul>
      <p>
        We do not receive your Facebook password, your friends list, your private messages, or the posts on your personal profile.
      </p>

      <h3>Information we create when you use the Service</h3>
      <ul>
        <li>
          <strong>Usage records:</strong> counts of actions such as AI generations and stock photo searches, used to apply fair-use limits.
        </li>
        <li>
          <strong>Activity log:</strong> a record of important actions in your workspace (who did what, and when), such as approving a post or connecting a Page.
        </li>
        <li>
          <strong>Publishing records:</strong> which post was scheduled for which Page, its status, the ID Facebook returns, and error codes if something failed.
        </li>
      </ul>

      <h3>Technical information</h3>
      <p>
        Like most online services, our hosting and authentication providers process technical data such as IP address, browser type, device type, and request
        times. We use it to deliver the Service, keep it secure, and investigate abuse. We also use cookies that are strictly necessary for signing in; see our{" "}
        <Link href="/cookies">Cookie Notice</Link>.
      </p>

      <h2>3. How we use information</h2>
      <ul>
        <li>to provide the Service: store your workspace, generate drafts, let your team review them, and publish the posts you approve to the Pages you connect;</li>
        <li>to keep the Service secure, prevent abuse and spam, and enforce usage limits;</li>
        <li>to give you support and send important service messages, such as a failed post or a Page that needs to be reconnected;</li>
        <li>to find and fix problems and to improve reliability and quality;</li>
        <li>to meet our legal obligations and to protect our rights.</li>
      </ul>
      <p>
        <strong>We do not sell your personal information, and we do not use it for advertising or to build advertising profiles.</strong>
      </p>

      <h2>4. Artificial intelligence</h2>
      <p>
        To write drafts, we send the text you provide (such as your topic, notes, tone settings, and the text of a web page you asked us to use) to AI model
        providers that we select for the Service. Depending on how the Service is configured, these may include Anthropic, OpenAI, Google, and OpenRouter. They
        process the text to return a draft. We do not use your content to train our own models, and each provider handles the data under its own terms. Please do
        not put sensitive personal information (such as health details, government ID numbers, or passwords) into topics or notes. AI drafts can contain mistakes;
        you review every post before it is published.
      </p>

      <h2>5. Facebook and Meta Platform data</h2>
      <p>
        If you connect Facebook, we use the permissions you grant (<code>pages_show_list</code>, <code>pages_read_engagement</code>, and{" "}
        <code>pages_manage_posts</code>) only to:
      </p>
      <ul>
        <li>show you the Pages you manage so you can choose which to connect;</li>
        <li>check that a connection still works;</li>
        <li>publish posts that you or your team approved, at the time you scheduled, to the Page you chose.</li>
      </ul>
      <p>
        We do not use Facebook data for advertising, we do not sell it, and we do not share it except with the service providers described below that help us run
        the Service. We follow the Meta Platform Terms and Developer Policies. You can stop this at any time: disconnect the Page in LazyAI (we delete our stored
        access immediately) and remove LazyAI in Facebook under Settings, then Business Integrations. Removing the app from Facebook also asks us to delete the
        Facebook connection data we hold for you. Details are on our <Link href="/data-deletion">Data Deletion</Link> page.
      </p>
      <p>LazyAI is an independent service and is not affiliated with or endorsed by Meta.</p>

      <h2>6. Who we share information with</h2>
      <p>We share information only as needed to run the Service, and with these kinds of recipients:</p>
      <ul>
        <li>
          <strong>Infrastructure providers:</strong> Supabase (database, authentication, and file storage) and Vercel (hosting).
        </li>
        <li>
          <strong>AI providers:</strong> the providers named in section 4, for the text needed to write drafts.
        </li>
        <li>
          <strong>Stock photo provider:</strong> Pexels receives the words you search for when you use stock photo search. Photos you add are copied into your
          private storage.
        </li>
        <li>
          <strong>Meta Platforms:</strong> when you connect a Page or publish a post, the content you approved and the technical information needed to publish it
          go to Facebook.
        </li>
        <li>
          <strong>Email provider:</strong> if and when we send service emails, an email delivery provider receives your email address and the message.
        </li>
        <li>
          <strong>Your workspace:</strong> people you invite to your workspace can see the workspace content that their role allows.
        </li>
        <li>
          <strong>Professional advisers and authorities:</strong> where the law requires it, or to protect rights, safety, and security.
        </li>
        <li>
          <strong>A successor:</strong> if we are part of a merger, acquisition, or sale of assets, information may transfer under the commitments in this policy.
        </li>
      </ul>
      <p>These providers may only use your information to provide their service to us, under their own terms and privacy commitments.</p>

      <h2>7. International transfers</h2>
      <p>
        Our providers may process information in countries other than yours. Where the law requires it, we rely on appropriate safeguards for those transfers.
      </p>

      <h2>8. How long we keep information</h2>
      <ul>
        <li>We keep your account and workspace content while your account is active.</li>
        <li>You can delete posts, images, and Pages yourself at any time. Disconnecting a Page deletes our stored access token for it immediately.</li>
        <li>
          When you ask us to delete your account or your data, we complete the request within {DELETION_DAYS} days. Copies in provider backups are overwritten on
          the provider’s normal schedule. We may keep limited records where the law requires it or where needed to resolve disputes and prevent abuse.
        </li>
        <li>Short-lived sign-in and connection records (such as an unfinished Facebook connection) are removed automatically after a few minutes.</li>
      </ul>

      <h2>9. Security</h2>
      <p>
        We protect information with encryption in transit (HTTPS), access controls that keep each workspace separate from others, restricted staff access, and
        encryption of Facebook Page access tokens at rest. No online service can be completely secure. If you believe your account or a connection has been
        compromised, tell us right away at <ContactEmail />.
      </p>

      <h2>10. Your choices and rights</h2>
      <p>Depending on where you live, you may have the right to:</p>
      <ul>
        <li>access the personal information we hold about you and get a copy;</li>
        <li>correct information that is wrong or incomplete;</li>
        <li>delete your information;</li>
        <li>object to or restrict certain processing, and withdraw consent where we rely on it;</li>
        <li>complain to your local data protection authority.</li>
      </ul>
      <p>
        You can manage much of this yourself in the app: edit or delete content, remove images, and disconnect Pages. For anything else, email{" "}
        <ContactEmail />. We may ask you to confirm your identity first, and we will reply within the time the law requires and, for deletion, within{" "}
        {DELETION_DAYS} days.
      </p>

      <h2>11. Children</h2>
      <p>
        The Service is for businesses and adults. It is not directed to anyone under 18, and we do not knowingly collect personal information from children. If you
        believe a child has given us information, contact us and we will delete it.
      </p>

      <h2>12. Changes to this policy</h2>
      <p>
        We may update this policy as the Service changes. We will change the “Last updated” date above and, for material changes, tell you in the app or by email
        before they take effect.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions or requests about privacy: <ContactEmail />. You can also use our <Link href="/contact">Contact page</Link>.
      </p>
    </LegalPage>
  );
}
