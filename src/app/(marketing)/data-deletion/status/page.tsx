import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { getDeletionStatus } from "@/lib/data/social";

export const metadata: Metadata = { title: "Data Deletion Status", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DeletionStatusPage({ searchParams }: Props) {
  const raw = (await searchParams).code;
  const code = typeof raw === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(raw) ? raw : null;

  let message: string;
  if (!code) {
    message = "That confirmation code does not look right. Check it and try again.";
  } else {
    let found: Awaited<ReturnType<typeof getDeletionStatus>> = null;
    try {
      found = await getDeletionStatus(code);
    } catch {
      return (
        <LegalPage title="Data Deletion Status">
          <p>We could not check the status right now. Please try again in a few minutes.</p>
        </LegalPage>
      );
    }
    if (!found) message = "We could not find a request with that code. Check it and try again.";
    else if (found.status === "completed") message = "Your Facebook connection data has been deleted. LazyAI no longer has access to your Facebook Pages.";
    else if (found.status === "failed") message = "We could not finish this request automatically. Please contact us from the Contact page and quote your confirmation code.";
    else message = "We received your request and are working on it.";
  }

  return (
    <LegalPage title="Data Deletion Status">
      <p role="status" className="rounded-xl bg-ink-50 px-4 py-3">
        {message}
      </p>
      <p>
        Back to <Link href="/data-deletion">Data Deletion</Link>.
      </p>
    </LegalPage>
  );
}
