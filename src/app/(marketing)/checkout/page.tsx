import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { startCheckoutAction } from "@/app/app/billing/actions";
import { CheckoutSignupForm } from "@/components/checkout/checkout-signup-form";
import { ButtonLink } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import { canAdmin } from "@/lib/auth/permissions";
import { getAppContext } from "@/lib/auth/session";
import { getBillingCurrency, listVisiblePlans } from "@/lib/data/plans";
import { PERIODS, PERIOD_LABELS, isPeriod, priceFor, type Period } from "@/lib/payments/billing";
import { formatPrice, yearlySavingsPercent } from "@/lib/pricing";
import { paymentsAvailable } from "@/lib/services/billing";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CheckoutPage({ searchParams }: Props) {
  const sp = await searchParams;
  const planKey = typeof sp.plan === "string" ? sp.plan : "";
  const [plans, currency, ctx, available] = await Promise.all([listVisiblePlans().catch(() => []), getBillingCurrency(), getAppContext(), paymentsAvailable()]);
  const plan = plans.find((p) => p.key === planKey);
  if (!plan) redirect("/pricing");

  const priced = { key: plan.key, priceMonthly: plan.price_monthly, priceYearly: plan.price_yearly, priceLifetime: plan.price_lifetime, lifetimeAvailable: plan.lifetime_available };
  const paid = plan.key !== "free" && plan.price_monthly !== 0;
  const offered = PERIODS.filter((p) => priceFor(priced, p) !== null);
  const period: Period = isPeriod(sp.period) && offered.includes(sp.period) ? sp.period : (offered[0] ?? "monthly");
  const amount = paid ? priceFor(priced, period) : null;
  if (paid && amount === null) redirect("/pricing");
  const amountLabel = amount === null ? null : formatPrice(amount, currency);
  const savings = yearlySavingsPercent(plan.price_monthly, plan.price_yearly);
  const here = (p: Period) => `/checkout?plan=${plan.key}&period=${p}`;

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Checkout</h1>
      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_1.1fr]">
        <aside className="h-fit space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Your plan</p>
          <h2 className="font-display text-2xl font-bold">{plan.name}</h2>
          {plan.tagline ? <p className="text-sm text-ink-600">{plan.tagline}</p> : null}
          {paid ? (
            <>
              {offered.length > 1 ? (
                <div role="group" aria-label="Billing period" className="flex flex-wrap gap-2">
                  {offered.map((p) => (
                    <Link
                      key={p}
                      href={here(p)}
                      aria-current={p === period ? "true" : undefined}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium ${p === period ? "border-brand bg-brand-50 text-brand-700" : "border-ink-200 text-ink-700 hover:bg-ink-50"}`}
                    >
                      {PERIOD_LABELS[p]}
                      {p === "yearly" && savings ? ` (save ${savings}%)` : ""}
                    </Link>
                  ))}
                </div>
              ) : null}
              <p className="font-display text-3xl font-extrabold text-ink">
                {amountLabel}
                <span className="text-base font-medium text-ink-500">{period === "monthly" ? " / month" : period === "yearly" ? " / year" : " one time"}</span>
              </p>
              <p className="text-xs text-ink-500">
                {period === "lifetime" ? "One payment, no renewal." : "Paid once for the period. It does not renew by itself; you can renew any time."} Unused AI posts do not carry over.
              </p>
            </>
          ) : (
            <p className="font-display text-3xl font-extrabold text-ink">Free</p>
          )}
          <ul className="space-y-1.5 border-t border-ink-100 pt-4 text-sm text-ink-700">
            {plan.features.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
          <Link href="/pricing" className="inline-block text-sm font-medium text-brand hover:underline">
            Choose a different plan
          </Link>
        </aside>

        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          {ctx ? (
            !paid ? (
              <div className="space-y-4">
                <p className="text-sm text-ink-700">You are signed in as {ctx.user.email}. The free plan needs nothing more.</p>
                <ButtonLink href="/app">Go to my dashboard</ButtonLink>
              </div>
            ) : !available ? (
              <p className="text-sm text-ink-700">Online payment is not open yet. Please check back soon.</p>
            ) : !canAdmin(ctx.role) ? (
              <p className="text-sm text-ink-700">Only the owner or an admin of the workspace can change the plan.</p>
            ) : (
              <form action={startCheckoutAction} className="space-y-4">
                <input type="hidden" name="plan" value={plan.key} />
                <input type="hidden" name="period" value={period} />
                <h2 className="font-display text-xl font-bold">Pay with bKash</h2>
                <p className="text-sm text-ink-600">You are signed in as {ctx.user.email}. You will pay on bKash’s own page and come back to your dashboard.</p>
                <PendingButton pendingLabel="Taking you to bKash…" variant="primary">
                  Pay {amountLabel} with bKash
                </PendingButton>
              </form>
            )
          ) : paid && !available ? (
            <div className="space-y-4">
              <p className="text-sm text-ink-700">Online payment is not open yet. You can start with the free plan now and upgrade later.</p>
              <ButtonLink href="/checkout?plan=free" variant="secondary">
                Start with the free plan
              </ButtonLink>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-xl font-bold">Create your account</h2>
                <p className="mt-1 text-sm text-ink-600">
                  Already have an account?{" "}
                  <Link href={`/auth/login?next=${encodeURIComponent(paid ? "/app/billing?plan=" + plan.key : "/app")}`} className="font-medium text-brand hover:underline">
                    Log in
                  </Link>
                </p>
              </div>
              <CheckoutSignupForm plan={plan.key} period={period} paid={paid} amountLabel={amountLabel} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
