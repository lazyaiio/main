import type { Metadata } from "next";
import { Facebook } from "lucide-react";
import {
  checkPageAction,
  disconnectPageAction,
  startFacebookConnectionAction,
} from "@/app/app/pages/actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { isCurrentUserPlatformAdmin } from "@/lib/auth/admin";
import { canAdmin } from "@/lib/auth/permissions";
import { requireAppContext } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { messageForCode } from "@/lib/service-messages";
import { getPagesOverview } from "@/lib/services/social";
import { describeSocialError, type SocialErrorKind } from "@/lib/social/provider";

export const metadata: Metadata = { title: "Facebook Pages" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const NOTICES: Record<string, string> = {
  connected_one: "Page connected. LazyAI can now prepare posts for it.",
  connected_many: "Pages connected. LazyAI can now prepare posts for them.",
  checked: "The connection works.",
  disconnected: "Page disconnected. Its saved access was deleted.",
};

const KINDS: SocialErrorKind[] = ["denied", "token_expired", "permission_missing", "page_access_lost", "rate_limited", "temporary", "content_rejected", "invalid_request", "not_configured", "unknown"];

function statusBadge(status: string) {
  if (status === "connected") return <Badge tone="green">Connected</Badge>;
  if (status === "error") return <Badge tone="amber">Needs attention</Badge>;
  return <Badge tone="neutral">Disconnected</Badge>;
}

export default async function FacebookPagesPage({ searchParams }: Props) {
  const ctx = await requireAppContext();
  const sp = await searchParams;
  const admin = canAdmin(ctx.role);
  const operator = await isCurrentUserPlatformAdmin();
  const { setup, pages } = await getPagesOverview(ctx);

  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const error = messageForCode(sp.error);
  const visible = pages.filter((p) => p.status !== "disconnected");
  const disconnected = pages.filter((p) => p.status === "disconnected");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Facebook Pages"
        description="Connect the Facebook Pages you want to post to. LazyAI only prepares posts here; nothing is published without your approval."
        action={
          admin && setup.ready ? (
            <form action={startFacebookConnectionAction}>
              <PendingButton variant="primary" pendingLabel="Opening Facebook…">
                {visible.length > 0 ? "Connect another Page" : "Connect Facebook"}
              </PendingButton>
            </form>
          ) : undefined
        }
      />

      {notice ? (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {setup.mode === "mock" ? (
        <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Test mode: this is a pretend Facebook with sample Pages. No real account is used and nothing can be posted.
        </p>
      ) : null}

      {!setup.ready ? (
        <section aria-label="Setup needed" className="max-w-2xl space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-display text-lg font-bold text-amber-900">Facebook connection is not set up yet</h2>
          <p className="text-sm text-amber-900">
            {operator
              ? "Create a Meta app and add its settings in Vercel. The step-by-step guide is docs/META_SETUP.md in the project. Admin -> Deployment shows what is still missing."
              : "Connecting Facebook is not available yet. We are finishing the setup, so please check back soon or contact us."}
          </p>
          {operator && setup.missing.length > 0 ? (
            <div className="text-sm text-amber-900">
              <p className="font-medium">Still missing in Vercel:</p>
              <ul className="mt-1 list-disc pl-5">
                {setup.missing.map((name) => (
                  <li key={name}>
                    <code>{name}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {operator ? (
            <p className="text-sm text-amber-900">
              Redirect address to register in the Meta app: <code className="break-all rounded bg-white px-1.5 py-0.5">{setup.redirectUri}</code>
            </p>
          ) : null}
        </section>
      ) : null}

      {visible.length === 0 && setup.ready ? (
        <EmptyState
          icon={Facebook}
          title="No Pages connected yet"
          body={admin ? "Connect Facebook, choose the Pages to use, and you are ready to plan posts for them." : "A workspace owner or admin can connect your Facebook Pages."}
        />
      ) : null}

      {visible.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {visible.map((page) => {
            const problemKind = page.last_error_code && (KINDS as string[]).includes(page.last_error_code) ? (page.last_error_code as SocialErrorKind) : null;
            return (
              <li key={page.id} className="space-y-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-lg font-bold">{page.name}</h2>
                    <p className="text-xs text-ink-500">
                      {page.category ?? "Facebook Page"}
                      {page.accountName ? ` · connected by ${page.accountName}` : ""}
                    </p>
                  </div>
                  {statusBadge(page.status)}
                </div>

                <p className="text-xs text-ink-500">
                  {page.last_validated_at ? `Last checked ${formatDateTime(page.last_validated_at, ctx.workspace.timezone)}` : "Not checked yet"}
                  {page.canPublish ? "" : " · view-only role (cannot post)"}
                </p>

                {page.status === "error" ? (
                  <p role="alert" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
                    {problemKind ? describeSocialError(problemKind) : "This connection needs attention. Reconnect the Page."}
                  </p>
                ) : null}

                {admin ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <form action={checkPageAction}>
                      <input type="hidden" name="pageId" value={page.id} />
                      <PendingButton variant="secondary" pendingLabel="Checking…">
                        Check connection
                      </PendingButton>
                    </form>
                    {page.status === "error" && setup.ready ? (
                      <form action={startFacebookConnectionAction}>
                        <PendingButton variant="primary" pendingLabel="Opening Facebook…">
                          Reconnect
                        </PendingButton>
                      </form>
                    ) : null}
                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium text-red-700">Disconnect</summary>
                      <form action={disconnectPageAction} className="mt-2 space-y-2">
                        <input type="hidden" name="pageId" value={page.id} />
                        <p className="max-w-xs text-xs text-ink-600">
                          LazyAI deletes its saved access to this Page. To also remove the app from Facebook, open Facebook Settings, then Business Integrations.
                        </p>
                        <PendingButton variant="ghost" pendingLabel="Disconnecting…">
                          Disconnect this Page
                        </PendingButton>
                      </form>
                    </details>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {disconnected.length > 0 ? (
        <section aria-label="Disconnected Pages" className="space-y-2">
          <h2 className="font-display text-base font-bold text-ink-700">Disconnected</h2>
          <ul className="space-y-1 text-sm text-ink-600">
            {disconnected.map((page) => (
              <li key={page.id}>{page.name} (connect it again from Connect Facebook)</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
