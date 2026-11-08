import type { Metadata } from "next";
import { headers } from "next/headers";
import { CheckCircle2, CircleAlert, Circle } from "lucide-react";
import { toggleLaunchItemAction } from "@/app/admin/launch/actions";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { readLaunchDone } from "@/lib/data/launch";
import { evaluate, summarize, type Evaluated } from "@/lib/launch-checklist";
import { collectLaunchFacts } from "@/lib/services/launch";

export const metadata: Metadata = { title: "Launch" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function Icon({ item }: { item: Evaluated }) {
  if (item.state === "ok") return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Done" />;
  if (item.state === "warn") return <CircleAlert className="h-5 w-5 shrink-0 text-amber-600" aria-label="Worth a look" />;
  return <Circle className="h-5 w-5 shrink-0 text-ink-600" aria-label="Not done" />;
}

export default async function LaunchPage({ searchParams }: Props) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const requestHost = (await headers()).get("x-forwarded-host") ?? (await headers()).get("host");
  const [facts, done] = await Promise.all([collectLaunchFacts(requestHost), readLaunchDone()]);
  const items = evaluate(facts, done);
  const summary = summarize(items);
  const groups = Array.from(new Set(items.map((i) => i.group)));

  return (
    <div className="space-y-6">
      <PageHeader title="Launch checklist" description="Everything to check before you take real money and real customers. Automatic items update by themselves. Manual items are yours to tick." />
      {sp.error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">That change could not be saved. Please try again.</p> : null}

      <section aria-label="Summary" className={`rounded-2xl border p-6 shadow-card ${summary.ready ? "border-emerald-200 bg-emerald-50" : "border-ink-100 bg-white"}`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-3xl font-extrabold">{summary.percent}%</p>
            <p className="text-sm text-ink-700">{summary.requiredDone} of {summary.required} required items done · {summary.optionalDone} of {summary.optional} optional</p>
          </div>
          <p role="status" className={`rounded-full px-3 py-1 text-sm font-bold ${summary.ready ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-900"}`}>{summary.ready ? "Ready to launch" : "Not ready yet"}</p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
          <div className="h-full rounded-full bg-brand" style={{ width: `${summary.percent}%` }} />
        </div>
        {!summary.ready ? <p className="mt-3 text-sm text-ink-700">Still blocking launch: {summary.blockers.slice(0, 3).join("; ")}{summary.blockers.length > 3 ? `; and ${summary.blockers.length - 3} more` : ""}.</p> : <p className="mt-3 text-sm text-emerald-800">Every required item is done. The final call is yours: this list cannot see everything, so read it once more before you announce.</p>}
      </section>

      {groups.map((group) => (
        <section key={group} aria-label={group} className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
          <h2 className="border-b border-ink-100 bg-ink-50 px-5 py-3 font-display text-base font-bold">{group}</h2>
          <ul className="divide-y divide-ink-100">
            {items.filter((i) => i.group === group).map((item) => (
              <li key={item.id} id={item.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                <Icon item={item} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.title}{item.required ? null : <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">Optional</span>}</p>
                  <p className="text-sm text-ink-600">{item.detail} <span className="text-ink-500">Where: {item.where}</span></p>
                </div>
                {item.kind === "manual" ? (
                  <form action={toggleLaunchItemAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="done" value={item.doneAt ? "0" : "1"} />
                    <PendingButton pendingLabel="Saving…" variant={item.doneAt ? "secondary" : "primary"}>{item.doneAt ? "Undo" : "Mark done"}</PendingButton>
                  </form>
                ) : <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Automatic</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
