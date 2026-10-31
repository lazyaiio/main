"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";

export type TrackingIds = { ga4: string; gtm: string; metaPixel: string; clarity: string };

const STORAGE_KEY = "lazyai-tracking-consent";
type Choice = "granted" | "denied";

/** Opens the cookie choice again (used by the "Cookie choices" link in the footer). */
export function CookieChoicesLink() {
  return (
    <button
      type="button"
      className="text-sm font-medium text-ink-600 hover:text-ink"
      onClick={() => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Storage is blocked: nothing to reset.
        }
        window.dispatchEvent(new Event("lazyai-consent-reset"));
      }}
    >
      Cookie choices
    </button>
  );
}

/**
 * Optional analytics and ad tags. Nothing is loaded and no cookie is set until the visitor presses Accept.
 * The IDs were checked on the server (letters, numbers and dashes only) before they reach this component.
 */
export function TrackingScripts({ ids }: { ids: TrackingIds }) {
  const [choice, setChoice] = useState<Choice | "unknown" | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        setChoice(saved === "granted" || saved === "denied" ? saved : "unknown");
      } catch {
        setChoice("unknown");
      }
    };
    read();
    window.addEventListener("lazyai-consent-reset", read);
    return () => window.removeEventListener("lazyai-consent-reset", read);
  }, []);

  const decide = (value: Choice) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // The choice is only kept for this visit.
    }
    setChoice(value);
  };

  return (
    <>
      {choice === "granted" ? <Tags ids={ids} /> : null}
      {choice === "unknown" ? (
        <div role="region" aria-label="Cookie choices" className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-200 bg-white p-4 shadow-soft">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
            <p className="max-w-2xl text-sm text-ink-700">
              We would like to use cookies from analytics and advertising tools to understand how the site is used. They stay off unless you accept. Our own visit counts never use cookies. See the{" "}
              <Link href="/cookies" className="font-semibold text-brand underline">
                Cookie Notice
              </Link>
              .
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => decide("denied")} className="h-10 rounded-xl border border-ink-300 px-5 text-sm font-semibold text-ink hover:bg-ink-50">
                Decline
              </button>
              <button type="button" onClick={() => decide("granted")} className="h-10 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-ink-800">
                Accept
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Tags({ ids }: { ids: TrackingIds }) {
  return (
    <>
      {ids.gtm && /^GTM-[A-Z0-9]{4,10}$/.test(ids.gtm) ? (
        <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${ids.gtm}');`}</Script>
      ) : null}
      {ids.ga4 && /^G-[A-Z0-9]{6,14}$/.test(ids.ga4) ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ids.ga4}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ids.ga4}',{anonymize_ip:true});`}</Script>
        </>
      ) : null}
      {ids.metaPixel && /^\d{8,20}$/.test(ids.metaPixel) ? (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${ids.metaPixel}');fbq('track','PageView');`}</Script>
      ) : null}
      {ids.clarity && /^[a-z0-9]{8,12}$/.test(ids.clarity) ? (
        <Script id="clarity" strategy="afterInteractive">{`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${ids.clarity}");`}</Script>
      ) : null}
    </>
  );
}
