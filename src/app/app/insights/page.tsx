import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { refreshInsightsAction } from "@/app/app/insights/actions";
import { InsightBars } from "@/components/app/insight-bars";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { canWrite } from "@/lib/auth/permissions";
import { requireAppContext } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { INSIGHT_RANGES, PAGE_METRICS, canRefresh, changeText, describeMetricProblem, formatCount, isRange, type InsightsSnapshot, type RangeDays } from "@/lib/insights";
import { messageForCode } from "@/lib/service-messages";
import { getInsightsFor, getInsightsOverview } from "@/lib/services/insights";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const NOTICES: Record<string, string> = { refreshed: "Insights refreshed.", recent: "Your numbers were refreshed a few minutes ago, so nothing new was fetched. Facebook updates most numbers about once a day." };
const ERROR_TEXT: Record<string, string> = { rate_limited: "You have refreshed Insights several times this hour. Please try again a little later." };

export default async function InsightsPage({ searchParams }: Props) {
  const ctx = await requireAppContext();
  const sp = await searchParams;
  const overview = await getInsightsOverview(ctx);
  const requested = one(sp.page);
  const selected = overview.pages.find((p) => p.id === requested) ?? overview.pages[0] ?? null;
  const rangeParam = Number(one(sp.range));
  const range: RangeDays = isRange(rangeParam) ? rangeParam : 28;
  const notice = one(sp.notice) ? NOTICES[one(sp.notice) as string] : undefined;
  const errorCode = one(sp.error);
  const error = errorCode ? (ERROR_TEXT[errorCode] ?? messageForCode(errorCode)) : undefined;

  const stored = selected && selected.access.state === "ready" ? await getInsightsFor(ctx, selected.id, range).catch(() => null) : null;
  const snapshot: InsightsSnapshot | null = stored?.snapshot ?? null;
  const writer = canWrite(ctx.role);
  const href = (pageId: string, r: number) => `/app/insights?page=${pageId}&range=${r}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Insights" description="How your Facebook Page is doing. The numbers come from Facebook, and most of them update about once a day." />
      {notice ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {!selected ? (
        <EmptyState icon={BarChart3} title="Connect a Facebook Page first" body="Insights show how your connected Pages are doing." action={<Link href="/app/pages" className="font-semibold text-brand underline">Go to Facebook Pages</Link>} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <nav aria-label="Pages" className="flex flex-wrap gap-2">
              {overview.pages.map((p) => (
                <Link key={p.id} href={href(p.id, range)} aria-current={p.id === selected.id ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${p.id === selected.id ? "border-brand bg-brand text-white" : "border-ink-200 bg-white text-ink hover:bg-ink-50"}`}>{p.name}</Link>
              ))}
            </nav>
            <nav aria-label="Time range" className="ml-auto flex gap-2">
              {INSIGHT_RANGES.map((r) => (
                <Link key={r} href={href(selected.id, r)} aria-current={r === range ? "page" : undefined} className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${r === range ? "border-ink bg-ink text-white" : "border-ink-200 bg-white text-ink hover:bg-ink-50"}`}>Last {r} days</Link>
              ))}
            </nav>
          </div>

          {selected.access.state === "not_enabled" ? (
            <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card"><h2 className="font-display text-lg font-bold">Insights are coming soon</h2><p className="mt-1 text-sm text-ink-600">Facebook has to approve this feature for LazyAI first. Nothing is needed from you right now. We will switch it on as soon as it is approved.</p></section>
          ) : null}
          {selected.access.state === "page_not_connected" ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-display text-lg font-bold">This Page needs to be reconnected</h2><p className="mt-1 text-sm text-ink-700">LazyAI cannot reach this Page right now.</p><Link href="/app/pages" className="mt-3 inline-block text-sm font-semibold text-brand underline">Open Facebook Pages</Link></section>
          ) : null}
          {selected.access.state === "needs_reconnect" ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-display text-lg font-bold">Reconnect Facebook to see Insights</h2><p className="mt-1 text-sm text-ink-700">This connection was made before Insights existed, or the Insights permission was not allowed. Connect Facebook again and allow every permission shown. Your Pages and scheduled posts stay as they are.</p><Link href="/app/pages" className="mt-3 inline-block text-sm font-semibold text-brand underline">Open Facebook Pages</Link></section>
          ) : null}

          {selected.access.state === "ready" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-600">{stored ? `Last updated ${formatDateTime(stored.fetchedAt, ctx.workspace.timezone)}.` : "No numbers saved yet."}</p>
                {writer ? (
                  <form action={refreshInsightsAction}>
                    <input type="hidden" name="page" value={selected.id} />
                    <input type="hidden" name="range" value={String(range)} />
                    <PendingButton pendingLabel="Fetching from Facebook…" variant={stored ? "secondary" : "primary"}>{stored ? (canRefresh(stored.fetchedAt) ? "Refresh numbers" : "Refreshed just now") : "Get my numbers"}</PendingButton>
                  </form>
                ) : <Badge tone="neutral">Viewers cannot refresh</Badge>}
              </div>

              {!snapshot ? (
                <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card"><h2 className="font-display text-lg font-bold">Get your first numbers</h2><p className="mt-1 text-sm text-ink-600">Press the button to fetch the last {range} days from Facebook. Facebook only shows Insights for Pages with at least 100 likes, and the person who connected the Page needs the Analyze role on it.</p></section>
              ) : (
                <>
                  <p className="text-sm text-ink-600">{snapshot.currentFrom} to {snapshot.currentTo}. Compared with the {range} days before.{snapshot.page.followers !== null ? ` Followers now: ${formatCount(snapshot.page.followers)}.` : ""}</p>
                  <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {PAGE_METRICS.map((def) => {
                      const m = snapshot.metrics.find((x) => x.key === def.key);
                      const change = m ? changeText(m.changePct) : null;
                      return (
                        <li key={def.key} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
                          <p className="text-sm font-semibold text-ink-700">{def.label}</p>
                          {m && m.problem === null && m.total !== null ? (
                            <>
                              <p className="mt-1 font-display text-3xl font-extrabold text-ink">{formatCount(m.total)}</p>
                              {change ? <p className="text-sm text-ink-600">{change} vs the {range} days before</p> : <p className="text-sm text-ink-500">No earlier numbers to compare</p>}
                              <InsightBars label={def.label} points={m.points} />
                            </>
                          ) : <p className="mt-2 text-sm text-ink-600">{m?.problem ? describeMetricProblem(m.problem) : "No data."}</p>}
                          <p className="mt-2 text-xs text-ink-500">{def.help}</p>
                        </li>
                      );
                    })}
                  </ul>

                  <section aria-label="Posts" className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
                    <h2 className="border-b border-ink-100 bg-ink-50 px-5 py-3 font-display text-base font-bold">Recent posts published by LazyAI</h2>
                    {snapshot.posts.length === 0 ? <p className="px-5 py-4 text-sm text-ink-600">No posts published through LazyAI in the last 90 days.</p> : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[40rem] text-left text-sm">
                          <thead className="text-xs uppercase tracking-wide text-ink-500"><tr><th className="px-5 py-2">Post</th><th className="px-3 py-2">Published</th><th className="px-3 py-2 text-right">Views</th><th className="px-3 py-2 text-right">People reached</th><th className="px-3 py-2 text-right">Clicks</th><th className="px-5 py-2 text-right">Reactions</th></tr></thead>
                          <tbody className="divide-y divide-ink-100">
                            {snapshot.posts.map((p) => (
                              <tr key={p.scheduledPostId}>
                                <td className="max-w-xs px-5 py-2"><span className="line-clamp-2">{p.title}</span>{p.problem ? <span className="block text-xs text-ink-500">{describeMetricProblem(p.problem)}</span> : null}</td>
                                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(p.publishedAt, ctx.workspace.timezone)}</td>
                                {[p.views, p.viewers, p.clicks].map((v, i) => <td key={i} className="px-3 py-2 text-right tabular-nums">{v === null ? "–" : formatCount(v)}</td>)}
                                <td className="px-5 py-2 text-right tabular-nums">{p.reactions === null ? "–" : formatCount(p.reactions)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </>
              )}
              <p className="text-xs text-ink-500">Numbers are read from Facebook with your permission and saved here so the page loads fast. They are replaced each time you refresh and deleted when you disconnect the Page. Some numbers are estimates made by Facebook, and a few days of recent data can still change.</p>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
