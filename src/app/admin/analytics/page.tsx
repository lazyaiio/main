import type { Metadata } from "next";
import Link from "next/link";
import { saveAnalyticsSettingsAction } from "@/app/admin/analytics/actions";
import { TopList } from "@/components/admin/top-list";
import { TrafficChart } from "@/components/admin/traffic-chart";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { BUCKET_LABELS, RANGES, allowedBuckets, fillBuckets, isRangeKey, percent, resolveRange, type RangeKey } from "@/lib/analytics";
import { getFirstViewAt, getReport, readAnalyticsSettings, type AnalyticsReport } from "@/lib/data/analytics";
import { formatPrice } from "@/lib/pricing";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const KIND: Record<string, string> = { direct: "Direct", search: "Search", social: "Social", email: "Email", paid: "Paid", campaign: "Campaign", referral: "Other sites" };

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

const num = (n: number) => n.toLocaleString("en-US");

export default async function AnalyticsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const range: RangeKey = isRangeKey(sp.range) ? sp.range : "7d";
  const [settings, first] = await Promise.all([readAnalyticsSettings(), getFirstViewAt().catch(() => null)]);
  const { from, to, bucket } = resolveRange(range, sp.bucket, new Date(), first);

  let report: AnalyticsReport | null = null;
  let failed = false;
  try {
    report = await getReport(from, to, bucket);
  } catch {
    failed = true;
  }
  const notice = sp.notice === "saved" ? "Saved." : undefined;
  const error = sp.error === "retention" ? "Keep the data between 30 and 3650 days." : sp.error ? "Could not save." : undefined;
  const t = report?.totals;
  const series = report ? fillBuckets(report.series, from, to, bucket) : [];
  const href = (r: RangeKey, b?: string) => `/admin/analytics?range=${r}${b ? `&bucket=${b}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Visits to the public website. No cookies and no stored IP addresses. Times are in UTC." />
      {notice ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {!settings.enabled ? <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Tracking is switched off, so new visits are not counted.</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Time range" className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <Link key={r.key} href={href(r.key)} aria-current={r.key === range ? "true" : undefined} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${r.key === range ? "border-brand bg-brand-50 text-brand-700" : "border-ink-200 text-ink-700 hover:bg-ink-50"}`}>
              {r.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Group by" className="flex items-center gap-2 text-sm">
          <span className="text-ink-500">View by</span>
          {allowedBuckets(range).map((b) => (
            <Link key={b} href={href(range, b)} aria-current={b === bucket ? "true" : undefined} className={`rounded-full px-3 py-1.5 font-medium ${b === bucket ? "bg-ink text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}>
              {BUCKET_LABELS[b]}
            </Link>
          ))}
        </nav>
      </div>

      {failed || !report || !t ? (
        <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Statistics are not available. Check that migration 0020 was run.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Visitors" value={num(t.visitors)} hint="Counted per day" />
            <Kpi label="Page views" value={num(t.pageviews)} />
            <Kpi label="Sessions" value={num(t.sessions)} hint={t.sessions > 0 ? `${(t.pageviews / t.sessions).toFixed(1)} pages per session` : undefined} />
            <Kpi label="Bounce rate" value={`${percent(t.bounced_sessions, t.sessions)}%`} hint="Sessions with one page" />
            <Kpi label="Sign-ups" value={num(t.signups)} hint={t.visitors > 0 ? `${percent(t.signups, t.visitors)}% of visitors` : undefined} />
            <Kpi label="Payments" value={num(t.payments)} />
            <Kpi label="Revenue" value={formatPrice(Number(t.revenue), "BDT")} />
            <Kpi label="On the site now" value={num(report.online_now)} hint="Last 30 minutes" />
          </div>

          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <h2 className="font-display text-lg font-bold">{BUCKET_LABELS[bucket]} traffic</h2>
            <div className="mt-4">
              <TrafficChart points={series} bucket={bucket} />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <TopList title="Top pages" rows={report.pages} />
            <TopList title="Traffic sources" rows={report.sources} label={(r) => `${r.name}${r.kind && r.kind !== "direct" ? ` · ${KIND[r.kind] ?? r.kind}` : ""}`} />
            <TopList title="Entry pages" rows={report.entry_pages} empty="No sessions yet." />
            <TopList title="Exit pages" rows={report.exit_pages} empty="No sessions yet." />
            <TopList title="Source types" rows={report.source_kinds} label={(r) => KIND[r.name] ?? r.name} />
            <TopList title="Referring sites" rows={report.referrers} empty="No visits from other sites." />
            <TopList title="Countries" rows={report.countries} />
            <TopList title="Devices" rows={report.devices} label={(r) => r.name.charAt(0).toUpperCase() + r.name.slice(1)} />
            <TopList title="Browsers" rows={report.browsers} />
            <TopList title="Operating systems" rows={report.systems} />
            <TopList title="Campaigns (utm links)" rows={report.campaigns} empty="No campaign links used. Add ?utm_source=…&utm_medium=…&utm_campaign=… to a link to track it." />
          </div>
          <p className="text-xs text-ink-500">
            Sources, devices, browsers, systems and countries count sessions (visits), not page views. A visitor is a one-way label that changes every day, so a person who comes on three different days is counted three times. Bots and visitors who send &ldquo;Do Not Track&rdquo; are not counted.
          </p>
        </>
      )}

      <form action={saveAnalyticsSettingsAction} className="flex flex-wrap items-end gap-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="h-4 w-4 accent-brand" /> Count visits to the public website
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          Keep data for (days)
          <input name="retentionDays" type="number" min={30} max={3650} defaultValue={settings.retentionDays} className="mt-1 block w-32 rounded-xl border border-ink-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" />
        </label>
        <PendingButton pendingLabel="Saving…">Save settings</PendingButton>
      </form>
    </div>
  );
}
