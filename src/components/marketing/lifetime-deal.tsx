import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { daysLeftText, type LifetimeOffer } from "@/lib/lifetime-deal";
import { formatPrice } from "@/lib/pricing";

const checkoutHref = (key: string) => `/checkout?plan=${key}&period=lifetime`;

/** The big card on the pricing page. */
export function LifetimeDealBanner({ offer }: { offer: LifetimeOffer }) {
  const left = daysLeftText(offer.daysLeft);
  const first = offer.offers[0];
  if (!first) return null;
  return (
    <section id="lifetime" aria-labelledby="lifetime-heading" className="relative mt-10 scroll-mt-24 overflow-hidden rounded-3xl bg-ink p-7 text-white shadow-soft sm:p-10">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-brand/40 blur-3xl" />
      <div className="relative grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {offer.badge}
          </span>
          <h2 id="lifetime-heading" className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{offer.headline}</h2>
          {offer.subtext ? <p className="mt-3 max-w-xl text-white/80">{offer.subtext}</p> : null}
          {offer.endsOnText ? (
            <p className="mt-4 inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-amber-200">
              <span>Offer ends {offer.endsOnText}</span>
              {left ? <span className="rounded-full border border-amber-300/60 px-2.5 py-0.5 text-xs">{left}</span> : null}
            </p>
          ) : null}
          <div className="mt-6">
            <ButtonLink href={checkoutHref(first.key)} variant="light" size="lg">
              Get lifetime access
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          </div>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {offer.offers.map((o) => (
            <li key={o.key}>
              <Link href={checkoutHref(o.key)} className="flex items-center justify-between gap-4 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 transition-colors hover:bg-white/15">
                <span className="font-display text-lg font-bold">{o.name}</span>
                <span className="text-right">
                  <span className="block font-display text-2xl font-extrabold text-amber-300">{formatPrice(o.price, offer.currency)}</span>
                  <span className="block text-xs text-white/75">one time, no renewal</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** A slim line for the home page. */
export function LifetimeDealStrip({ offer }: { offer: LifetimeOffer }) {
  const first = offer.offers[0];
  if (!first) return null;
  const left = daysLeftText(offer.daysLeft);
  return (
    <div className="border-y border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-3 text-sm text-ink sm:px-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {offer.badge}
        </span>
        <p className="font-semibold">
          {offer.headline} <span className="font-normal">From {formatPrice(first.price, offer.currency)} one time{left ? ` · ${left}` : ""}.</span>
        </p>
        <Link href="/pricing#lifetime" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:no-underline">
          See the lifetime deal
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

/** A small pill for the site header. */
export function LifetimeDealPill({ badge, className = "" }: { badge: string; className?: string }) {
  return (
    <Link href="/pricing#lifetime" className={`inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink transition-colors hover:bg-amber-200 ${className}`}>
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      {badge}
    </Link>
  );
}
