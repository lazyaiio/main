import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { changePlanAction } from "@/app/admin/plans/actions";
import { getDb } from "@/lib/data/db";
import { listPlans, listWorkspacesForAdmin } from "@/lib/data/plans";
import { LIMIT_KEYS, LIMIT_LABELS, formatAmount } from "@/lib/plans";

export const metadata: Metadata = { title: "Plans" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PlansAdminPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [plans, workspaces] = await Promise.all([listPlans(await getDb()).catch(() => null), listWorkspacesForAdmin().catch(() => null)]);
  const notice = sp.notice === "changed" ? "Plan changed." : undefined;
  const error = sp.error ? "That change could not be made. Check that migration 0013 was run." : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Plans" description="Limits are stored in the database and enforced on the server. Change a workspace's plan here." />

      {notice ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section aria-label="Plans" className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Plan limits</h2>
        {plans ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th scope="col" className="py-2 pr-4">Plan</th>
                  {LIMIT_KEYS.map((key) => (
                    <th key={key} scope="col" className="py-2 pr-4">{LIMIT_LABELS[key].label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {plans.map((plan) => (
                  <tr key={plan.key}>
                    <th scope="row" className="py-2 pr-4 font-semibold">{plan.name}</th>
                    {LIMIT_KEYS.map((key) => (
                      <td key={key} className="py-2 pr-4">{typeof plan.limits[key] === "number" ? formatAmount(key, plan.limits[key] as number) : "no limit"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-600">Plans are not available. Check that migration 0013 was run.</p>
        )}
        <p className="mt-3 text-xs text-ink-500">To give one workspace different numbers, see docs/SECURITY.md (a short SQL statement).</p>
      </section>

      <section aria-label="Workspaces" className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Workspaces</h2>
        {workspaces && plans ? (
          <ul className="mt-3 divide-y divide-ink-100">
            {workspaces.map((ws) => (
              <li key={ws.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{ws.name}</p>
                  <p className="text-xs text-ink-500">
                    {ws.plan}
                    {Object.keys(ws.limit_overrides ?? {}).length > 0 ? " · special limits set" : ""}
                  </p>
                </div>
                <form action={changePlanAction} className="flex items-center gap-2">
                  <input type="hidden" name="workspaceId" value={ws.id} />
                  <select name="plan" defaultValue={ws.plan} aria-label={`Plan for ${ws.name}`} className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm">
                    {plans.map((plan) => (
                      <option key={plan.key} value={plan.key}>{plan.name}</option>
                    ))}
                  </select>
                  <PendingButton variant="secondary" pendingLabel="Saving…">Change</PendingButton>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-600">The workspace list is not available. Check that the Supabase service key is set.</p>
        )}
        <p className="mt-3 text-xs text-ink-500">Changing the plan also clears any special limits that were set for that workspace.</p>
      </section>
    </div>
  );
}
