import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { connectPagesAction } from "@/app/app/pages/actions";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { canAdmin } from "@/lib/auth/permissions";
import { requireAppContext } from "@/lib/auth/session";
import { messageForCode } from "@/lib/service-messages";
import { ServiceError } from "@/lib/services/errors";
import { getPendingSelection, type PendingSelection } from "@/lib/services/social";

export const metadata: Metadata = { title: "Choose Pages" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ChoosePagesPage({ searchParams }: Props) {
  const ctx = await requireAppContext();
  if (!canAdmin(ctx.role)) redirect("/app/pages");

  const sp = await searchParams;
  const flow = z.string().uuid().safeParse(sp.flow);
  if (!flow.success) redirect("/app/pages?error=social_attempt_expired");

  let selection: PendingSelection;
  try {
    selection = await getPendingSelection(ctx, flow.data);
  } catch (error) {
    redirect(`/app/pages?error=${error instanceof ServiceError ? error.kind : "failed"}`);
  }
  const error = messageForCode(sp.error);
  const choosable = selection.pages.filter((p) => p.canPublish);

  return (
    <div className="space-y-6">
      <Link href="/app/pages" className="text-sm font-medium text-ink-500 hover:text-ink">
        ← Facebook Pages
      </Link>
      <PageHeader
        title="Choose Pages to connect"
        description={`Signed in to Facebook as ${selection.accountName}. Only the Pages you tick are saved; the others are forgotten.`}
      />

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form action={connectPagesAction} className="max-w-2xl space-y-4">
        <input type="hidden" name="flowId" value={selection.flowId} />
        <fieldset className="space-y-2">
          <legend className="sr-only">Pages</legend>
          {selection.pages.map((page) => (
            <label
              key={page.id}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                page.canPublish ? "cursor-pointer border-ink-200 bg-white has-[:checked]:border-brand has-[:checked]:bg-brand-50" : "border-ink-100 bg-ink-50 text-ink-500"
              }`}
            >
              <input
                type="checkbox"
                name="pageId"
                value={page.id}
                defaultChecked={page.canPublish && !page.alreadyConnected}
                disabled={!page.canPublish}
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span className="min-w-0">
                <span className="block font-medium text-ink">{page.name}</span>
                <span className="block text-xs text-ink-500">
                  {page.category ?? "Facebook Page"}
                  {page.alreadyConnected ? " · already connected (this refreshes it)" : ""}
                  {!page.canPublish ? " · your role on this Page cannot create posts" : ""}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {choosable.length === 0 ? (
          <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            None of your Pages allow you to create posts. Ask a Page admin to give you a role that can post, then connect again.
          </p>
        ) : (
          <PendingButton variant="primary" pendingLabel="Connecting…">
            Connect selected Pages
          </PendingButton>
        )}
      </form>
    </div>
  );
}
