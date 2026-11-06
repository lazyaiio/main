import { AnalyticsBeacon } from "@/components/marketing/analytics-beacon";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { CookieChoicesLink, TrackingScripts } from "@/components/marketing/tracking-scripts";
import { AnnouncementBanner } from "@/components/site/announcement-banner";
import { hasTracking } from "@/lib/seo";
import { loadNotice } from "@/lib/services/notices";
import { loadSeo } from "@/lib/services/seo";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [{ settings }, notice] = await Promise.all([loadSeo(), loadNotice()]);
  const tracking = settings.tracking;
  const useTags = hasTracking(tracking);
  return (
    <>
      {notice.announcement.enabled ? <AnnouncementBanner {...notice.announcement} /> : null}
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="outline-none">{children}</main>
      <SiteFooter cookieChoices={useTags ? <CookieChoicesLink /> : undefined} />
      <AnalyticsBeacon />
      {useTags ? <TrackingScripts ids={tracking} /> : null}
    </>
  );
}
