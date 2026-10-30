import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { changePlanAction, updateCurrencyAction } from "@/app/admin/plans/actions";
import { PlanEditor } from "@/components/admin/plan-editor";
import { getDb } from "@/lib/data/db";
import { getBillingCurrency, listPlans, listWorkspacesForAdmin } from "@/lib/data/plans";
import { CURRENCIES } from "@/lib/pricing";
import { LIMIT_KEYS, LIMIT_LABELS, formatAmount } from "@/lib/plans";

export const metadata: Metadata = { title: "Plans" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PlansAdminPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [plans, workspaces, currency] = await Promise.all([listPlans(await getDb()).catch(() => null), listWorkspacesForAdmin().catch(() => null), getBillingCurrency()]);
  const notice = sp.notice === "changed" ? "Plan changed." : sp.notice === "saved" ? "Saved." : undefined;
  const error = sp.error ? "That change could not be made. Check the numbers, and that migrations 0013 and 0015 were run." : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Plans" description="Limits are stored in the database and enforced on the server. Change a workspace's plan here." />

      {notice ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section aria-label="Pricing" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Pricing page</h2>
            <p className="text-sm text-ink-600">What visitors see on /pricing. Leave a price empty to show &ldquo;Price coming soon&rdquo;.</p>
          </div>
          <form action={updateCurrencyAction} className="flex items-end gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Currency
              <select name="currency" defaultValue={currency} className="mt-1 block rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink">
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <PendingButton pendingLabel="Saving…">Save</PendingButton>
          </form>
        </div>
        {plans ? plans.map((plan) => <PlanEditor key={plan.key} plan={plan} currency={currency} />) : null}
      </section>

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
          <p className="mt-2 text-sm text-ink-600">Plans are not available. Check that migrations 0013 and 0015 were run.</p>
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
