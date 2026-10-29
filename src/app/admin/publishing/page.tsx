import type { Metadata } from "next";
import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";
import { RunPublisherForm } from "@/components/admin/run-publisher-form";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { requireAppContext } from "@/lib/auth/session";
import { getDb } from "@/lib/data/db";
import { getHeartbeat, getPublishingOverview, isLiveFlagOn } from "@/lib/data/platform";
import { formatDateTime } from "@/lib/format";
import { getCronSecret, getSocialSetup, isPublishingBlockedByEnv } from "@/lib/social/keys";
import { cn } from "@/lib/utils";
import { setLivePublishingAction } from "@/app/admin/publishing/actions";

export const metadata: Metadata = { title: "Publishing" };
export const dynamic = "force-dynamic";
// "Publish due posts now" can take a while.
export const maxDuration = 60;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const NOTICES: Record<string, string> = {
  live_on: "Live publishing is ON. Due posts will be published to Facebook on the next scheduler run.",
  live_off: "Live publishing is OFF. Scheduled posts wait.",
};
const ERRORS: Record<string, string> = {
  confirm: "Tick the confirmation box to turn live publishing on.",
  failed: "Could not change the switch. Check that migration 0011 was run, then try again.",
};

type Check = { label: string; state: "ok" | "warn" | "bad"; detail: string };

function Icon({ state }: { state: Check["state"] }) {
  if (state === "ok") return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="OK" />;
  if (state === "warn") return <CircleAlert className="h-5 w-5 shrink-0 text-amber-600" aria-label="Needs attention" />;
  return <CircleX className="h-5 w-5 shrink-0 text-red-600" aria-label="Problem" />;
}

function ago(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 90) return `${seconds} seconds ago`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} minutes ago`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)} hours ago`;
  return `${Math.round(seconds / 86400)} days ago`;
}

export default async function PublishingAdminPage({ searchParams }: Props) {
  const ctx = await requireAppContext();
  const sp = await searchParams;
  const db = await getDb();
  const now = Date.now();

  const [liveOn, overview, heartbeat] = await Promise.all([isLiveFlagOn(db), getPublishingOverview(db), getHeartbeat(db).catch(() => null)]);
  const setup = getSocialSetup();
  const blocked = isPublishingBlockedByEnv();
  const cron = getCronSecret() !== null;
  const beatAgeMs = heartbeat ? now - new Date(heartbeat.at).getTime() : null;

  const checks: Check[] = [
    {
      label: "Facebook connection settings",
      state: setup.mode === "off" ? "bad" : setup.missing.length > 0 ? "bad" : "ok",
      detail:
        setup.mode === "mock"
          ? "Test mode (pretend Facebook) is active."
          : setup.mode === "off"
            ? "META_APP_ID and META_APP_SECRET are missing in your hosting settings (see docs/META_SETUP.md)."
            : setup.missing.length > 0
              ? `Still missing in your hosting settings: ${setup.missing.join(", ")}.`
              : "The Meta app, the encryption key, and the service key are all set.",
    },
    {
      label: "Scheduler secret (CRON_SECRET)",
      state: cron ? "ok" : "bad",
      detail: cron ? "Set." : "Missing or shorter than 16 characters. Add CRON_SECRET in your hosting settings and redeploy (docs/SCHEDULER_SETUP.md, step 2).",
    },
    {
      label: "Scheduler is calling this site",
      state: !heartbeat ? "bad" : beatAgeMs !== null && beatAgeMs > 5 * 60_000 ? "warn" : "ok",
      detail: !heartbeat
        ? "The scheduler has never called the site. Do the Supabase steps in docs/SCHEDULER_SETUP.md (steps 3 to 5), or press the button below to publish by hand."
        : beatAgeMs !== null && beatAgeMs > 5 * 60_000
          ? `The last run was ${ago(heartbeat.at, now)}. It should run every minute. Check the cron job in Supabase (SQL: select * from cron.job_run_details order by start_time desc limit 5;).`
          : `Last run ${ago(heartbeat.at, now)}.`,
    },
    {
      label: "Live publishing switch",
      state: blocked ? "bad" : liveOn ? "ok" : "warn",
      detail: blocked
        ? "Blocked by the environment setting LIVE_PUBLISHING_ENABLED=0. Remove that setting (or set it to 1) and redeploy."
        : liveOn
          ? "ON: due posts are published to Facebook."
          : "OFF: scheduled posts wait. Turn it on below when you are ready for real posting.",
    },
  ];

  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Publishing" description="Switch real Facebook posting on or off, and see whether scheduled posts are going out." />

      {notice ? (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Live publishing</h2>
            <p className="mt-1 max-w-xl text-sm text-ink-600">
              When ON, scheduled posts are published to the Facebook Pages at their scheduled time. When OFF, scheduled posts wait and nothing is posted.
            </p>
          </div>
          <Badge tone={liveOn && !blocked ? "green" : "amber"}>{liveOn && !blocked ? "ON" : "OFF"}</Badge>
        </div>

        {liveOn ? (
          <form action={setLivePublishingAction} className="mt-4">
            <PendingButton variant="secondary" pendingLabel="Switching off…">
              Switch live publishing OFF
            </PendingButton>
          </form>
        ) : (
          <form action={setLivePublishingAction} className="mt-4 space-y-3">
            <input type="hidden" name="enable" value="on" />
            <label className="flex items-start gap-2.5 text-sm text-ink-700">
              <input type="checkbox" name="confirm" className="mt-0.5 h-4 w-4 accent-brand" />
              <span>I understand that real posts will be published to connected Facebook Pages.</span>
            </label>
            <PendingButton variant="primary" pendingLabel="Switching on…">
              Switch live publishing ON
            </PendingButton>
          </form>
        )}
      </section>

      <section aria-label="Checks" className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Checks</h2>
        <ul className="mt-3 divide-y divide-ink-100">
          {checks.map((check) => (
            <li key={check.label} className="flex items-start gap-3 py-3">
              <Icon state={check.state} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{check.label}</p>
                <p className={cn("text-sm", check.state === "ok" ? "text-ink-500" : "text-ink-700")}>{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Queue" className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Queue (all workspaces)</h2>
        {overview ? (
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              ["Due now", overview.due_now],
              ["Waiting", overview.waiting],
              ["Publishing", overview.publishing],
              ["Failed", overview.failed],
              ["Published (24 h)", overview.published_24h],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-xs uppercase tracking-wide text-ink-500">{label}</dt>
                <dd className="font-display text-2xl font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-ink-600">The overview is not available. Check that migration 0011 was run.</p>
        )}
        {overview && overview.due_now > 0 ? (
          <p className="mt-3 text-sm text-amber-800">
            {overview.due_now} {overview.due_now === 1 ? "post is" : "posts are"} due now (the oldest has waited about {Math.round(overview.oldest_due_seconds / 60)} min). If live publishing is ON and the scheduler is running, they go out within a minute.
          </p>
        ) : null}
      </section>

      <section aria-label="Run now" className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Publish by hand</h2>
        <p className="mt-1 max-w-xl text-sm text-ink-600">
          Runs the publisher once, right now, without waiting for the scheduler. It follows the same rules (and the switch above).
        </p>
        <div className="mt-4">
          <RunPublisherForm />
        </div>
      </section>

      <section aria-label="Time" className="rounded-2xl border border-ink-100 bg-ink-50 p-6 text-sm text-ink-700">
        <h2 className="font-display text-base font-bold">About time zones</h2>
        <p className="mt-2">
          The server runs on UTC time ({new Date(now).toISOString().slice(0, 16).replace("T", " ")} UTC now). LazyAI stores every schedule as an exact moment and
          always converts using your <strong>workspace time zone</strong> ({ctx.workspace.timezone}; now {formatDateTime(new Date(now).toISOString(), ctx.workspace.timezone)}). The
          time zone of the server and of your computer do not matter. The time you type when scheduling is read as {ctx.workspace.timezone} time; change it in Settings if needed.
        </p>
      </section>
    </div>
  );
}
