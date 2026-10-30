import type { Metadata } from "next";
import Link from "next/link";
import { PlaceholderPage } from "@/components/marketing/placeholder-page";
import { ButtonLink } from "@/components/ui/button";
import { getBillingCurrency, listVisiblePlans, type PlanRow } from "@/lib/data/plans";
import { formatPrice, limitHighlights, yearlySavingsPercent } from "@/lib/pricing";

export const metadata: Metadata = { title: "Pricing" };
// Prices are edited in Admin, so this page is built on request instead of once at deploy time.
export const dynamic = "force-dynamic";

async function load(): Promise<{ plans: PlanRow[]; currency: Awaited<ReturnType<typeof getBillingCurrency>> } | null> {
  try {
    const [plans, currency] = await Promise.all([listVisiblePlans(), getBillingCurrency()]);
    return plans.length > 0 ? { plans, currency } : null;
  } catch {
    return null;
  }
}

export default async function PricingPage() {
  const data = await load();
  if (!data) {
    return <PlaceholderPage title="Pricing" body="Our plans are being updated. Please check back soon, or contact us with any questions." cta={{ label: "Contact us", href: "/contact" }} />;
  }
  const { plans, currency } = data;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">Simple pricing</h1>
        <p className="mt-3 text-lg text-ink-600">Start free. Move to a bigger plan when you need more posts, Pages, and images.</p>
      </div>

      <div className={`mt-12 grid gap-6 ${plans.length >= 3 ? "lg:grid-cols-3" : plans.length === 2 ? "md:grid-cols-2" : ""}`}>
        {plans.map((plan) => {
          const monthly = plan.price_monthly;
          const savings = yearlySavingsPercent(monthly, plan.price_yearly);
          const highlights = limitHighlights(plan.limits);
          const features = plan.features.length > 0 ? plan.features : highlights;
          return (
            <article
              key={plan.key}
              className={`relative flex flex-col rounded-3xl border bg-white p-7 shadow-card ${plan.highlighted ? "border-brand ring-2 ring-brand/30" : "border-ink-100"}`}
            >
              {plan.highlighted ? (
                <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">Most popular</span>
              ) : null}
              <h2 className="font-display text-2xl font-bold text-ink">{plan.name}</h2>
              {plan.tagline ? <p className="mt-1 text-sm text-ink-600">{plan.tagline}</p> : null}

              <div className="mt-6">
                {monthly === null ? (
                  <p className="font-display text-2xl font-bold text-ink-700">Price coming soon</p>
                ) : monthly === 0 ? (
                  <p className="font-display text-4xl font-extrabold text-ink">Free</p>
                ) : (
                  <p className="font-display text-4xl font-extrabold text-ink">
                    {formatPrice(monthly, currency)}
                    <span className="text-base font-medium text-ink-500"> / month</span>
                  </p>
                )}
                {plan.price_yearly && plan.price_yearly > 0 ? (
                  <p className="mt-1 text-sm text-ink-600">
                    or {formatPrice(plan.price_yearly, currency)} per year{savings ? ` (save ${savings}%)` : ""}
                  </p>
                ) : null}
              </div>

              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-ink-700">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <ButtonLink href="/signup" variant={plan.highlighted ? "primary" : "secondary"} className="w-full justify-center">
                  {monthly === 0 || monthly === null ? "Get started" : `Start with ${plan.name}`}
                </ButtonLink>
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-8 text-center text-xs text-ink-500">Prices are shown in {currency}. Questions? <Link href="/contact" className="font-semibold text-brand hover:underline">Contact us</Link>.</p>
    </section>
  );
}
