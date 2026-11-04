import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/auth/actions";
import { AppNav } from "@/components/app/app-nav";
import { MaintenanceScreen } from "@/components/app/maintenance-screen";
import { VerifyEmailBanner } from "@/components/app/verify-email-banner";
import { Logo } from "@/components/brand/logo";
import { AnnouncementBanner } from "@/components/site/announcement-banner";
import { isCurrentUserPlatformAdmin } from "@/lib/auth/admin";
import { getAppContext } from "@/lib/auth/session";
import { loadNotice } from "@/lib/services/notices";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · LazyAI" },
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/auth/login");
  if (!ctx.profile.onboarded_at) redirect("/onboarding");
  const isAdmin = await isCurrentUserPlatformAdmin();
  const notice = await loadNotice();
  // Maintenance mode hides the app from everyone except platform admins (who still need it to switch the mode off).
  if (notice.maintenance.enabled && !isAdmin) return <MaintenanceScreen message={notice.maintenance.message} />;

  return (
    <div className="min-h-screen bg-ink-50 md:grid md:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-ink-100 bg-white p-4 md:flex">
        <Link href="/app" aria-label="LazyAI dashboard" className="mb-6 px-2">
          <Logo className="h-7" />
        </Link>
        <AppNav orientation="vertical" isAdmin={isAdmin} />
        <div className="mt-auto space-y-3 rounded-xl bg-ink-50 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{ctx.workspace.name}</p>
            <p className="truncate text-xs text-ink-500">{ctx.user.email}</p>
            <p className="mt-0.5 text-xs text-ink-500">{ctx.workspace.timezone}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="border-b border-ink-100 bg-white pt-3 md:hidden">
          <Link href="/app" aria-label="LazyAI dashboard" className="mb-3 block px-4">
            <Logo className="h-6" />
          </Link>
          <AppNav orientation="horizontal" isAdmin={isAdmin} />
        </div>
        {notice.maintenance.enabled ? (
          <p role="status" className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
            Maintenance mode is on. Only platform admins can see the app right now.
          </p>
        ) : null}
        {notice.announcement.enabled ? <AnnouncementBanner {...notice.announcement} /> : null}
        {ctx.emailVerified ? null : <VerifyEmailBanner email={ctx.user.email} />}
        <main id="main-content" tabIndex={-1} className="outline-none mx-auto max-w-5xl p-4 sm:p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}
