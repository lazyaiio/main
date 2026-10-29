import Link from "next/link";
import { cancelScheduleAction, markSeenOnPageAction, rescheduleAction, retryScheduleAction, scheduleAction } from "@/app/app/schedule/actions";
import { Badge } from "@/components/ui/badge";
import { WhenField } from "@/components/schedule/when-field";
import { PendingButton } from "@/components/ui/pending-button";
import { formatDateTime } from "@/lib/format";
import { describeScheduleError, toLocalInputValue } from "@/lib/schedule-text";
import type { ItemScheduling } from "@/lib/services/scheduling";
import { postStatus } from "@/lib/status";

const INPUT = "h-11 rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

/** Schedule a post to a connected Facebook Page, and manage what is already scheduled. "approved" means the post is not canceled. */
export function ScheduleCard({
  itemId,
  approved,
  canEdit,
  data,
  timeZone,
  defaultWhen,
  nowIso,
  isPlatformAdmin,
}: {
  itemId: string;
  approved: boolean;
  canEdit: boolean;
  data: ItemScheduling;
  timeZone: string;
  defaultWhen: string;
  nowIso: string;
  isPlatformAdmin: boolean;
}) {
  const live = data.schedules.filter((s) => s.status !== "cancelled");
  const cancelled = data.schedules.filter((s) => s.status === "cancelled");

  return (
    <section aria-label="Schedule" className="max-w-2xl space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
      <h2 className="font-display text-lg font-bold">Schedule on Facebook</h2>

      {data.mock ? (
        <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          Test mode: posts go to a pretend Facebook. Nothing is really published.
        </p>
      ) : !data.publishingEnabled ? (
        <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          Live publishing is switched off for the whole site, so scheduled posts wait.{" "}
          {isPlatformAdmin ? (
            <>
              You are a platform admin:{" "}
              <Link href="/admin/publishing" className="font-semibold underline">
                open Admin, Publishing
              </Link>{" "}
              to switch it on and to check that the scheduler is running.
            </>
          ) : (
            "A platform admin can switch it on under Admin, Publishing."
          )}
        </p>
      ) : null}

      {canEdit ? (
        !approved ? (
          <p className="text-sm text-ink-600">This post is canceled. Restore it first, then you can schedule it.</p>
        ) : data.pages.length === 0 ? (
          <p className="text-sm text-ink-600">
            No Facebook Page is connected yet.{" "}
            <Link href="/app/pages" className="font-semibold text-brand hover:underline">
              Connect a Page
            </Link>
          </p>
        ) : (
          <form action={scheduleAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="itemId" value={itemId} />
            <div className="space-y-1.5">
              <label htmlFor="schedule-page" className="block text-sm font-medium text-ink-700">
                Page
              </label>
              <select id="schedule-page" name="pageId" required className={INPUT}>
                {data.pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name}
                  </option>
                ))}
              </select>
            </div>
            <WhenField id="schedule-when" defaultValue={defaultWhen} workspaceTimeZone={timeZone} nowIso={nowIso} />
            <PendingButton variant="primary" pendingLabel="Scheduling…">
              Schedule post
            </PendingButton>
            <p className="basis-full text-xs text-ink-500">You can change or cancel until the post goes out.</p>
          </form>
        )
      ) : null}

      {live.length > 0 ? (
        <ul className="space-y-3">
          {live.map((s) => {
            const meta = postStatus[s.status];
            const problem = s.status === "failed" || s.status === "retrying" ? describeScheduleError(s.last_error) : null;
            const uncertain = s.status === "failed" && s.last_error === "uncertain_result";
            return (
              <li key={s.id} className="space-y-3 rounded-xl border border-ink-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{s.pageName}</p>
                    <p className="text-xs text-ink-500">
                      {s.status === "published" && s.published_at ? `Published ${formatDateTime(s.published_at, timeZone)}` : formatDateTime(s.scheduled_at, timeZone)}
                    </p>
                  </div>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>

                {!approved && (s.status === "scheduled" || s.status === "retrying") ? (
                  <p role="alert" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
                    This post was canceled. Restore it before its time, or it will not be published.
                  </p>
                ) : null}

                {s.status === "scheduled" && new Date(s.scheduled_at).getTime() < new Date(nowIso).getTime() - 3 * 60_000 ? (
                  <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
                    This post is overdue. Posting only happens when live publishing is switched on and the scheduler is running.
                    {isPlatformAdmin ? (
                      <>
                        {" "}
                        <Link href="/admin/publishing" className="font-semibold underline">
                          Check Admin, Publishing
                        </Link>
                        .
                      </>
                    ) : null}
                  </p>
                ) : null}

                {problem ? (
                  <p role="alert" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
                    {problem}
                  </p>
                ) : null}

                {canEdit ? (
                  <div className="flex flex-wrap items-start gap-3">
                    {uncertain ? (
                      <>
                        <form action={markSeenOnPageAction}>
                          <input type="hidden" name="itemId" value={itemId} />
                          <input type="hidden" name="scheduleId" value={s.id} />
                          <PendingButton variant="secondary" pendingLabel="Saving…">
                            It is on my Page
                          </PendingButton>
                        </form>
                        <form action={retryScheduleAction}>
                          <input type="hidden" name="itemId" value={itemId} />
                          <input type="hidden" name="scheduleId" value={s.id} />
                          <PendingButton variant="secondary" pendingLabel="Retrying…">
                            It is not there: post it again
                          </PendingButton>
                        </form>
                      </>
                    ) : s.status === "failed" ? (
                      <form action={retryScheduleAction}>
                        <input type="hidden" name="itemId" value={itemId} />
                        <input type="hidden" name="scheduleId" value={s.id} />
                        <PendingButton variant="secondary" pendingLabel="Retrying…">
                          Retry now
                        </PendingButton>
                      </form>
                    ) : null}

                    {s.status === "scheduled" || s.status === "retrying" || s.status === "failed" ? (
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium text-ink-700">Change time</summary>
                        <form action={rescheduleAction} className="mt-2 flex flex-wrap items-end gap-2">
                          <input type="hidden" name="itemId" value={itemId} />
                          <input type="hidden" name="scheduleId" value={s.id} />
                          <WhenField id={`when-${s.id}`} label="New date and time" defaultValue={toLocalInputValue(s.scheduled_at, timeZone)} workspaceTimeZone={timeZone} nowIso={nowIso} compact />
                          <PendingButton pendingLabel="Saving…">Save</PendingButton>
                        </form>
                      </details>
                    ) : null}

                    {s.status === "scheduled" || s.status === "retrying" || s.status === "failed" ? (
                      <form action={cancelScheduleAction}>
                        <input type="hidden" name="itemId" value={itemId} />
                        <input type="hidden" name="scheduleId" value={s.id} />
                        <PendingButton variant="ghost" pendingLabel="Canceling…">
                          Cancel
                        </PendingButton>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {cancelled.length > 0 ? <p className="text-xs text-ink-500">{cancelled.length} canceled {cancelled.length === 1 ? "schedule" : "schedules"} not shown.</p> : null}
    </section>
  );
}
