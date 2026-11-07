import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { EXPORT_EXCLUDES, EXPORT_INCLUDES } from "@/lib/settings-export";

export const metadata: Metadata = { title: "Backup" };
export const dynamic = "force-dynamic";

export default async function BackupPage() {
  await requirePlatformAdmin();
  return (
    <div className="space-y-6">
      <PageHeader title="Backup" description="Download a copy of your site settings and written content. Keep it somewhere safe, for example before a big edit." />

      <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Site settings file</h2>
        <p className="mt-1 text-sm text-ink-600">One JSON file. It is created when you press the button and is not stored anywhere.</p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">Included</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700">{EXPORT_INCLUDES.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Not included</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700">{EXPORT_EXCLUDES.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
        <a href="/api/admin/settings-export" className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-600">Download settings</a>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-6 text-sm text-ink-700 shadow-card">
        <h2 className="font-display text-lg font-bold">What this is not</h2>
        <p className="mt-2">This file is a copy for safekeeping and for moving text to another site. There is no restore button yet. It is not a backup of your database: people, posts, payments and media are not in it. Use Supabase&apos;s own backups for the database, and see the go-live checklist in the docs.</p>
      </section>
    </div>
  );
}
