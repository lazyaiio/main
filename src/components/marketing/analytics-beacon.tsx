"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Tells the site's own server that a public page was opened. No cookies, no third-party scripts.
 * Skipped when the browser sends "Do Not Track" or "Global Privacy Control".
 */
export function AnalyticsBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === "1" || nav.globalPrivacyControl === true) return;
    const params = new URLSearchParams(window.location.search);
    const body = JSON.stringify({
      path: pathname,
      referrer: document.referrer,
      utm_source: params.get("utm_source") ?? undefined,
      utm_medium: params.get("utm_medium") ?? undefined,
      utm_campaign: params.get("utm_campaign") ?? undefined,
    });
    try {
      if (!navigator.sendBeacon("/api/analytics/collect", new Blob([body], { type: "application/json" }))) throw new Error("beacon refused");
    } catch {
      fetch("/api/analytics/collect", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
    }
  }, [pathname]);
  return null;
}
