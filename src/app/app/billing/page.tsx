import type { Metadata } from "next";
import { startCheckoutAction } from "@/app/app/billing/actions";
import { PendingButton } from "@/components/ui/pending-button";
import { PageHeader } from "@/components/ui/page-header";
import { canAdmin } from "@/lib/auth/permissions";
import { getAppContext } from "@/lib/auth/session";
import { getDb } from "@/lib/data/db";
import { getWorkspacePlanState, listWorkspacePayments } from "@/lib/data/payments";
import { getBillingCurrency, listVisiblePlans } from "@/lib/data/plans";
import { PERIOD_LABELS, PERIODS, daysLeft, priceFor } from "@/lib/payments/billing";
import { formatPrice, yearlySavingsPercent } from "@/lib/pricing";
import { paymentsAvailable } from "@/lib/services/billing";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const NOTICES: Record<string, string> = { paid: "Payment received. Your plan is active. Thank you!" };
const ERRORS: Record<string, string> = {
  canceled: "The payment was canceled. You were not charged.",
  failed: "The payment did not go through. You were not charged, or the amount will be returned by bKash. Please try again.",
  unknown: "We could not confirm the payment yet. If money left your bKash account, contact us with your invoice number.",
  invalid: "That request was not valid.",
  forbidden: "Only the owner or an admin of the workspace can change the plan.",
  not_configured: "Online payment is not available yet.",
  not_found: "That plan cannot be bought this way.",
  too_many_requests: "You started too many payments. Please wait a few minutes.",
};

export default async function BillingPage({ searchParams }: Props) {
  const ctx = await getAppContext();
  if (!ctx) return null;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

  const [state, plans, currency, available, payments] = await Promise.all([
    getWorkspacePlanState(ctx.workspace.id).catch(() => ({ plan: "free", plan_period: null, plan_expires_at: null })),
    listVisiblePlans().catch(() => []),
    getBillingCurrency(),
    paymentsAvailable(),
    getDb().then((db) => listWorkspacePayments(db, ctx.workspace.id)).catch(() => []),
  ]);
  const current = plans.find((p) => p.key === state.plan);
  const left = daysLeft(state.plan_expires_at);
  const notice = NOTICES[one(sp.notice)];
  const error = ERRORS[one(sp.error)];
  const wanted = one(sp.plan);
  const mayBuy = canAdmin(ctx.role) && available;

  return (
    <div className="space-y-8">
      <PageHeader title="Billing" description="Your plan, and how to change it." />
      {notice ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section className="max-w-2xl rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Current plan</h2>
        <p className="mt-2 text-sm text-ink-700">
          <strong className="text-ink">{current?.name ?? state.plan}</strong>
          {state.plan_period === "lifetime" ? " (lifetime)" : state.plan_period ? ` (${PERIOD_LABELS[state.plan_period].toLowerCase()})` : ""}
        </p>
        {left !== null ? (
          <p className="mt-1 text-sm text-ink-600">
            Active until {new Date(state.plan_expires_at as string).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })} ({left} {left === 1 ? "day" : "days"} left). After that your workspace moves to the Free plan. Unused AI posts do not carry over.
          </p>
        ) : state.plan !== "free" ? (
          <p className="mt-1 text-sm text-ink-600">This plan does not expire.</p>
        ) : null}
      </section>

      <section aria-label="Plans" className="space-y-4">
        <h2 className="font-display text-lg font-bold">Choose a plan</h2>
        {!available ? <p className="text-sm text-ink-600">Online payment is not available yet. Please check back soon or contact us.</p> : null}
        {!canAdmin(ctx.role) ? <p className="text-sm text-ink-600">Only the owner or an admin of the workspace can change the plan.</p> : null}
        <div className="grid gap-4 lg:grid-cols-3">
          {plans
            .filter((p) => p.key !== "free")
            .map((plan) => {
              const priced = { key: plan.key, priceMonthly: plan.price_monthly, priceYearly: plan.price_yearly, priceLifetime: plan.price_lifetime, lifetimeAvailable: plan.lifetime_available };
              const savings = yearlySavingsPercent(plan.price_monthly, plan.price_yearly);
              return (
                <article key={plan.key} className={`rounded-2xl border bg-white p-5 shadow-card ${wanted === plan.key ? "border-brand ring-2 ring-brand/30" : "border-ink-100"}`}>
                  <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                  {plan.tagline ? <p className="text-sm text-ink-600">{plan.tagline}</p> : null}
                  <ul className="mt-3 space-y-1.5 text-sm text-ink-700">
                    {plan.features.map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                  <div className="mt-4 space-y-2">
                    {PERIODS.map((period) => {
                      const amount = priceFor(priced, period);
                      if (amount === null) return null;
                      const isOwnLifetime = state.plan === plan.key && state.plan_period === "lifetime";
                      return (
                        <form key={period} action={startCheckoutAction} className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-3 py-2">
                          <input type="hidden" name="plan" value={plan.key} />
                          <input type="hidden" name="period" value={period} />
                          <span className="text-sm">
                            <span className="font-semibold">{PERIOD_LABELS[period]}</span> {formatPrice(amount, currency)}
                            {period === "yearly" && savings ? <span className="text-xs text-emerald-700"> (save {savings}%)</span> : null}
                            {period === "lifetime" ? <span className="text-xs text-ink-500"> one time</span> : null}
                          </span>
                          {mayBuy && !isOwnLifetime ? <PendingButton pendingLabel="Opening…">{state.plan === plan.key && period !== "lifetime" ? "Renew" : "Pay with bKash"}</PendingButton> : null}
                        </form>
                      );
                    })}
                    {priceFor(priced, "monthly") === null && priceFor(priced, "yearly") === null && priceFor(priced, "lifetime") === null ? (
                      <p className="text-sm text-ink-600">Price coming soon.</p>
                    ) : null}
                  </div>
                </article>
              );
            })}
        </div>
        <p className="text-xs text-ink-500">Monthly means one month and yearly means one year from the day you pay (renewing early adds to your current end date). Plans do not renew by themselves.</p>
      </section>

      <section className="max-w-3xl rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Payment history</h2>
        {payments.length === 0 ? (
          <p className="mt-2 text-sm text-ink-600">No payments yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {new Date(p.created_at).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })}: {p.plan_key} ({p.period}), {formatPrice(p.amount, "BDT")}
                </span>
                <span className="text-xs text-ink-500">
                  {p.status}
                  {p.provider_trx_id ? ` · ${p.provider_trx_id}` : ""} · {p.invoice_number}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
