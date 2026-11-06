import type { Metadata } from "next";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Field, SelectField, TextAreaField } from "@/components/auth/fields";
import { AnnouncementBanner } from "@/components/site/announcement-banner";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { Switch } from "@/components/ui/switch";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { readNotice } from "@/lib/data/notices";
import { NOTICE_LIMITS } from "@/lib/notices";
import { saveNoticeAction } from "./actions";

export const metadata: Metadata = { title: "Notices" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ notice?: string; error?: string }>;

export default async function NoticesAdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const notice = await readNotice();
  // The error text comes from our own checks (never from the address bar as HTML), and React escapes it.
  const error = params.error ? params.error.slice(0, 200) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Notices" description="A banner for news or warnings, and a maintenance switch. Text must be in English." />

      {params.notice === "saved" ? (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> Saved. It can take up to 30 seconds to appear everywhere.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" /> {error}
        </p>
      ) : null}

      <form action={saveNoticeAction} className="space-y-6">
        <section aria-labelledby="banner-title" className="space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <h2 id="banner-title" className="font-display text-lg font-bold">
            Announcement banner
          </h2>
          <p className="text-sm text-ink-600">Shows above every public page and above the signed-in app. Visitors can close it. It comes back when you change the text.</p>
          <Switch name="announcementEnabled" label="Show the banner" defaultChecked={notice.announcement.enabled} />
          <Field label="Banner text" name="text" maxLength={NOTICE_LIMITS.text} defaultValue={notice.announcement.text} hint={`Up to ${NOTICE_LIMITS.text} characters. Plain text only.`} />
          <SelectField label="Color" name="tone" defaultValue={notice.announcement.tone}>
            <option value="info">Blue (news)</option>
            <option value="success">Green (good news)</option>
            <option value="warning">Amber (warning)</option>
          </SelectField>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Link label (optional)" name="linkLabel" maxLength={NOTICE_LIMITS.linkLabel} defaultValue={notice.announcement.linkLabel} hint="For example: Learn more" />
            <Field label="Link address (optional)" name="linkUrl" maxLength={NOTICE_LIMITS.linkUrl} defaultValue={notice.announcement.linkUrl} hint="A page like /pricing, or an https:// address." />
          </div>
          {notice.announcement.text ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-500">Saved banner preview</p>
              <div className="overflow-hidden rounded-xl border border-ink-100">
                <AnnouncementBanner {...notice.announcement} preview />
              </div>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="maintenance-title" className="space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <h2 id="maintenance-title" className="font-display text-lg font-bold">
            Maintenance mode
          </h2>
          <p className="text-sm text-ink-600">
            While this is on, signed-in customers see a short maintenance page instead of the app. Platform admins still see everything, so you can switch it off again. The public website, the
            scheduler, and posts that are already scheduled keep running.
          </p>
          <Switch name="maintenanceEnabled" label="Turn maintenance mode on" description="Customers cannot use the app while it is on." defaultChecked={notice.maintenance.enabled} />
          <TextAreaField label="Message for customers" name="message" rows={3} maxLength={NOTICE_LIMITS.message} defaultValue={notice.maintenance.message} />
        </section>

        <PendingButton variant="primary" pendingLabel="Saving…">
          Save notices
        </PendingButton>
      </form>
    </div>
  );
}
