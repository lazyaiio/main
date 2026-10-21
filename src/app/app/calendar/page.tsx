import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireAppContext } from "@/lib/auth/session";
import { buildMonthGrid, localDateKey, monthLabel, monthQueryRange, parseMonthParam, shiftMonth } from "@/lib/calendar";
import { getDb } from "@/lib/data/db";
import { listScheduledPostsInRange } from "@/lib/data/overview";
import { formatDateTime } from "@/lib/format";
import { postStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({ searchParams }: Props) {
  const ctx = await requireAppContext();
  const tz = ctx.workspace.timezone;
  const today = localDateKey(new Date(), tz);
  const month = parseMonthParam((await searchParams).m, today.slice(0, 7));

  const { fromIso, toIso } = monthQueryRange(month);
  const posts = await listScheduledPostsInRange(await getDb(), ctx.workspace.id, fromIso, toIso);
  const inMonth = posts.filter((p) => localDateKey(p.scheduled_at, tz).startsWith(month));

  const byDay = new Map<string, number>();
  for (const post of inMonth) {
    const key = localDateKey(post.scheduled_at, tz);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  const weeks = buildMonthGrid(month);

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" description={`All times are shown in ${tz}.`} />

      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">{monthLabel(month)}</h2>
        <div className="flex items-center gap-1">
          <Link
            href={`/app/calendar?m=${shiftMonth(month, -1)}`}
            aria-label="Previous month"
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-100"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link href="/app/calendar" className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100">
            Today
          </Link>
          <Link
            href={`/app/calendar?m=${shiftMonth(month, 1)}`}
            aria-label="Next month"
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-100"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
        <div className="grid grid-cols-7 border-b border-ink-100 bg-ink-50 text-center text-xs font-semibold text-ink-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]!.iso} className="grid grid-cols-7 border-b border-ink-100 last:border-b-0">
            {week.map((day) => {
              const count = byDay.get(day.iso) ?? 0;
              return (
                <div
                  key={day.iso}
                  className={cn(
                    "min-h-16 border-r border-ink-100 p-1.5 last:border-r-0 sm:min-h-24 sm:p-2",
                    !day.inMonth && "bg-ink-50/60 text-ink-300",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium",
                      day.iso === today && "bg-brand text-white",
                    )}
                  >
                    {day.day}
                  </span>
                  {count > 0 ? (
                    <p className="mt-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">
                      {count} post{count === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <section aria-labelledby="month-list">
        <h2 id="month-list" className="font-display text-lg font-bold">
          Scheduled this month
        </h2>
        {inMonth.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-ink-200 bg-white px-5 py-8 text-center text-sm text-ink-600">
            Nothing is scheduled for {monthLabel(month)}. Scheduling arrives once posts can be generated and approved.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {inMonth.map((post) => {
              const meta = postStatus[post.status];
              return (
                <li key={post.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-400">{formatDateTime(post.scheduled_at, tz)}</p>
                    <p className="truncate text-sm font-medium">{post.title}</p>
                  </div>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
