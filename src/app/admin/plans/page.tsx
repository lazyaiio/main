import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { changePlanAction, saveLifetimeDealAction, updateCurrencyAction } from "@/app/admin/plans/actions";
import { PlanEditor } from "@/components/admin/plan-editor";
import { getDb } from "@/lib/data/db";
import { getBillingCurrency, listPlans, listWorkspacesForAdmin } from "@/lib/data/plans";
import { readLifetimeDeal } from "@/lib/data/lifetime-deal";
import { DEAL_LIMITS, dealBlocker, type DealPlan } from "@/lib/lifetime-deal";
import { CURRENCIES } from "@/lib/pricing";
import { LIMIT_KEYS, LIMIT_LABELS, formatAmount } from "@/lib/plans";

export const metadata: Metadata = { title: "Plans" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PlansAdminPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [plans, workspaces, currency, deal] = await Promise.all([listPlans(await getDb()).catch(() => null), listWorkspacesForAdmin().catch(() => null), getBillingCurrency(), readLifetimeDeal()]);
  const dealPlans: DealPlan[] = (plans ?? []).map((p) => ({ key: p.key, name: p.name, price_monthly: p.price_monthly, price_lifetime: p.price_lifetime, lifetime_available: p.lifetime_available, visible: p.visible }));
  const blocker = dealBlocker(deal, dealPlans, currency);
  const dealError = typeof sp.dealError === "string" ? sp.dealError.slice(0, 200) : undefined;
  const notice = sp.notice === "changed" ? "Plan changed." : sp.notice === "saved" ? "Saved." : sp.notice === "deal" ? "Lifetime deal saved." : undefined;
  const error = sp.error ? "That change could not be made. Check the numbers, and that migrations 0013 and 0015 were run." : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Plans" description="Limits are stored in the database and enforced on the server. Change a workspace's plan here." />

      {notice ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {dealError ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{dealError}</p> : null}

      <section aria-label="Lifetime deal" className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Lifetime deal highlight</h2>
            <p className="text-sm text-ink-600">Puts a gold badge in the site header, a strip on the home page, a big card on /pricing, and a ribbon on each plan that sells a lifetime option.</p>
          </div>
          <p role="status" className={`rounded-full px-3 py-1 text-xs font-bold ${blocker ? "bg-ink-100 text-ink-700" : "bg-emerald-100 text-emerald-800"}`}>{blocker ? "Not showing" : "Showing on the site"}</p>
        </div>
        {blocker ? <p className="mt-2 text-sm text-ink-700">Why: {blocker}</p> : null}
        <form action={saveLifetimeDealAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2">
            <input type="checkbox" name="enabled" defaultChecked={deal.enabled} className="h-4 w-4 rounded border-ink-300" />
            Show the lifetime deal
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Badge ({DEAL_LIMITS.badge} characters at most)
            <input name="badge" defaultValue={deal.badge} maxLength={DEAL_LIMITS.badge} required className="mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-normal normal-case text-ink" />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Ends on (UTC, optional)
            <input type="date" name="endsOn" defaultValue={deal.endsOn ?? ""} className="mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-normal normal-case text-ink" />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500 md:col-span-2">Headline ({DEAL_LIMITS.headline} characters at most)
            <input name="headline" defaultValue={deal.headline} maxLength={DEAL_LIMITS.headline} required className="mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-normal normal-case text-ink" />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500 md:col-span-2">Text under the headline ({DEAL_LIMITS.subtext} characters at most)
            <input name="subtext" defaultValue={deal.subtext} maxLength={DEAL_LIMITS.subtext} className="mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-normal normal-case text-ink" />
          </label>
          <p className="text-xs text-ink-600 md:col-span-2">
            The deal only highlights what your plans already sell. A plan needs a lifetime price and &ldquo;Lifetime available&rdquo; switched on (edit below). Write English only. If you set an end date, lifetime sales stop for real at the end of that day: the scheduler switches &ldquo;Lifetime available&rdquo; off on every plan and turns the deal off. People who already bought keep their lifetime plan. Only set an end date you mean.
          </p>
          <div className="md:col-span-2">
            <PendingButton pendingLabel="Saving…" variant="primary">Save lifetime deal</PendingButton>
          </div>
        </form>
      </section>

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
