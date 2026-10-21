import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { requireAppContext } from "@/lib/auth/session";
import { getDb } from "@/lib/data/db";
import { getDashboardStats, listCampaigns } from "@/lib/data/overview";

export default async function DashboardPage() {
  const ctx = await requireAppContext();
  const db = await getDb();
  const [stats, campaigns] = await Promise.all([
    getDashboardStats(db, ctx.workspace.id),
    listCampaigns(db, ctx.workspace.id, 3),
  ]);
  const name = ctx.profile.display_name || "there";

  const steps = [
    { label: "Create your account", done: true, href: null },
    { label: "Set up your workspace", done: true, href: null },
    { label: "Connect a Facebook Page", done: stats.pagesConnected > 0, href: "/app/pages" },
    { label: "Create your first project", done: stats.projects > 0, href: "/app/projects/new" },
    { label: "Generate and review posts", done: stats.contentTotal > 0, href: "/app/content" },
    { label: "Schedule approved posts", done: stats.scheduled + stats.published > 0, href: "/app/calendar" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const activeCampaigns = campaigns.filter((c) => c.status === "planning" || c.status === "generating");

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, ${name}`}
        description={`Your workspace “${ctx.workspace.name}” at a glance.`}
      />

      {stats.failed > 0 ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            {stats.failed} post{stats.failed === 1 ? "" : "s"} failed to publish.{" "}
            <Link href="/app/calendar" className="font-semibold underline">
              Review them
            </Link>
            .
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Connected Pages" value={stats.pagesConnected} href="/app/pages" />
        <StatCard label="Awaiting review" value={stats.awaitingReview} href="/app/content?status=awaiting_approval" />
        <StatCard label="Scheduled" value={stats.scheduled} href="/app/calendar" />
        <StatCard label="Published" value={stats.published} href="/app/calendar" />
      </div>

      {activeCampaigns.length > 0 ? (
        <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <h2 className="font-display text-lg font-bold">Campaigns in progress</h2>
          <ul className="mt-3 space-y-3">
            {activeCampaigns.map((c) => {
              const total = c.generation_progress.total ?? c.requested_item_count;
              const done = c.generation_progress.completed ?? 0;
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="shrink-0 text-ink-500">
                    {done}/{total} posts
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Getting started</h2>
          <span className="text-sm text-ink-500">
            {doneCount} of {steps.length} done
          </span>
        </div>
        <ul className="mt-4 divide-y divide-ink-100">
          {steps.map((step) => (
            <li key={step.label} className="flex items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-3 text-sm font-medium">
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                ) : (
                  <span className="h-5 w-5 rounded-full border-2 border-ink-200" aria-hidden="true" />
                )}
                {step.href && !step.done ? (
                  <Link href={step.href} className="hover:text-brand">
                    {step.label}
                  </Link>
                ) : (
                  step.label
                )}
              </span>
              {step.done ? <Badge tone="green">Done</Badge> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
