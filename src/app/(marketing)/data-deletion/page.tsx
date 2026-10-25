import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage } from "@/components/marketing/legal-page";
import { DELETION_DAYS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Data Deletion",
  description: "How to delete your LazyAI data and your Facebook connection data.",
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Data Deletion"
      intro="You can remove your Facebook connection yourself at any time, and you can ask us to delete your account and data. This page explains how."
    >
      <h2>Option 1: Remove the Facebook connection</h2>
      <p>This deletes the access LazyAI has to your Facebook Pages.</p>
      <ul>
        <li>
          <strong>In LazyAI:</strong> open <strong>Facebook Pages</strong>, choose <strong>Disconnect</strong> next to a Page. We delete our stored access token for
          that Page immediately.
        </li>
        <li>
          <strong>In Facebook:</strong> open Facebook, go to <strong>Settings</strong>, then <strong>Business Integrations</strong>, find <strong>LazyAI</strong>,
          and choose <strong>Remove</strong>. Facebook then tells LazyAI, and we automatically disconnect your Pages, delete the stored access tokens, and clear
          the Facebook profile details we kept (your Facebook ID and name). You receive a confirmation code that you can check below.
        </li>
      </ul>

      <h2>Option 2: Delete your LazyAI account and data</h2>
      <p>
        Send an email to <ContactEmail /> from the address you used to sign up, with the subject “Delete my LazyAI data”. Tell us whether you want us to delete the
        whole account or only some data. We may reply to confirm it is really you. We complete verified requests within {DELETION_DAYS} days and confirm by
        email.
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>your account details and workspace content: projects, campaigns, drafts, approvals, and schedules;</li>
        <li>images you uploaded and stock photos you added, including their small previews;</li>
        <li>your Facebook connection data: Page access tokens, Facebook ID and name, and Page details.</li>
      </ul>
      <h2>What we may keep</h2>
      <ul>
        <li>limited records that the law requires us to keep, or that we need to resolve disputes and prevent abuse;</li>
        <li>copies in provider backups, until they are overwritten on the provider’s normal schedule;</li>
        <li>content that you already published on Facebook stays on Facebook. LazyAI cannot delete it for you; manage it on your Page.</li>
      </ul>
      <p>
        If you are a member of someone else’s workspace, the workspace owner controls that workspace’s content. Ask the owner, or contact us and we will help.
      </p>

      <h2>Check a deletion request</h2>
      <p>If you started a deletion from Facebook, enter the confirmation code you received:</p>
      <form action="/data-deletion/status" method="get" className="mt-3 flex flex-wrap items-end gap-3 not-prose">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-ink-700">
            Confirmation code
          </label>
          <input
            id="code"
            name="code"
            required
            maxLength={64}
            pattern="[A-Za-z0-9_-]{8,64}"
            autoComplete="off"
            className="mt-1 h-11 w-64 rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <button type="submit" className="h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-ink-800">
          Check status
        </button>
      </form>

      <p className="mt-8">
        See also our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
