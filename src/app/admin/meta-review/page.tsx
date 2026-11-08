import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Circle, HelpCircle } from "lucide-react";
import { CopyBox } from "@/components/admin/copy-box";
import { PageHeader } from "@/components/ui/page-header";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { registrationAddresses } from "@/lib/deployment-checks";
import { META_PERMISSIONS, PERMISSION_ANSWERS, REJECTION_RISKS, SCREENCAST_STEPS, reviewerInstructions } from "@/lib/meta-review";
import { collectMetaFacts, probePublicPages } from "@/lib/services/meta-review";

export const metadata: Metadata = { title: "Meta review" };
export const dynamic = "force-dynamic";

function Mark({ state }: { state: "ok" | "todo" | "warn" | "unknown" }) {
  if (state === "ok") return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="OK" />;
  if (state === "warn") return <CircleAlert className="h-5 w-5 shrink-0 text-amber-600" aria-label="Worth a look" />;
  if (state === "unknown") return <HelpCircle className="h-5 w-5 shrink-0 text-ink-500" aria-label="Could not check" />;
  return <Circle className="h-5 w-5 shrink-0 text-red-500" aria-label="Fix this" />;
}

export default async function MetaReviewPage() {
  await requirePlatformAdmin();
  const { appUrl, checks } = await collectMetaFacts();
  const pages = await probePublicPages(appUrl);
  const addresses = registrationAddresses(process.env as Record<string, string | undefined>).filter((a) => a.label.startsWith("Meta"));
  const open = checks.filter((c) => c.state === "todo").length + pages.filter((p) => p.state === "todo").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Meta review" description="Check that the site is ready for Meta App Review, and copy the answers and instructions. LazyAI cannot submit the review for you: you do that in the Meta developer dashboard." />

      <section className={`rounded-2xl border p-5 shadow-card ${open === 0 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`} role="status">
        <p className="font-semibold">{open === 0 ? "Nothing on this page blocks a submission." : `${open} thing${open === 1 ? "" : "s"} to fix before you submit.`}</p>
        <p className="mt-1 text-sm text-ink-700">This is a site check only. Business verification, the reviewer account and the screencast are yours to do. Track them in <Link href="/admin/launch" className="font-semibold text-brand underline">Launch checklist</Link>.</p>
      </section>

      <section aria-label="Site checks" className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
        <h2 className="border-b border-ink-100 bg-ink-50 px-5 py-3 font-display text-base font-bold">Settings</h2>
        <ul className="divide-y divide-ink-100">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-5 py-3"><Mark state={c.state} /><div><p className="text-sm font-semibold">{c.label}</p><p className="text-sm text-ink-600">{c.detail}</p></div></li>
          ))}
        </ul>
        <h2 className="border-y border-ink-100 bg-ink-50 px-5 py-3 font-display text-base font-bold">Pages Meta will open (checked just now, without signing in)</h2>
        <ul className="divide-y divide-ink-100">
          {pages.map((p) => (
            <li key={p.path} className="flex items-start gap-3 px-5 py-3"><Mark state={p.state} /><div><p className="text-sm font-semibold">{p.label} <span className="font-normal text-ink-500">{p.path}</span></p><p className="text-sm text-ink-600">{p.detail}</p></div></li>
          ))}
        </ul>
      </section>

      <section aria-label="Addresses" className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">Addresses to paste into the Meta app</h2>
        <dl className="mt-3 grid gap-3 md:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.label} className="rounded-xl bg-ink-50 px-3 py-2"><dt className="text-xs font-semibold text-ink-500">{a.label}</dt><dd className="break-all font-mono text-sm text-ink">{a.value}</dd><dd className="text-xs text-ink-500">{a.where}</dd></div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-500">The deauthorize and deletion addresses accept only Meta&apos;s signed requests, so opening them in a browser shows an error. That is expected.</p>
      </section>

      <section aria-label="Permission answers" className="space-y-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">Permission answers (drafts)</h2>
        <p className="text-sm text-ink-600">LazyAI asks for exactly these three permissions. Edit the words so they describe what you really do.</p>
        {META_PERMISSIONS.map((p) => <CopyBox key={p} label={p} text={PERMISSION_ANSWERS[p]} rows={4} />)}
      </section>

      <section aria-label="Reviewer instructions" className="space-y-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">Instructions for the reviewer</h2>
        <p className="text-sm text-ink-600">Create a separate reviewer account on your live site first (with its own workspace), then fill in its email and password below before you paste this.</p>
        <CopyBox label="Reviewer instructions" text={reviewerInstructions(appUrl)} rows={14} />
      </section>

      <section aria-label="Screencast" className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">Screencast outline (about two minutes)</h2>
        <p className="text-sm text-ink-600">Record the real site with captions or a voice-over. Show every permission being used.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-500"><tr><th className="py-2 pr-4">Time</th><th className="py-2 pr-4">Show</th><th className="py-2">Say or caption</th></tr></thead>
            <tbody className="divide-y divide-ink-100">{SCREENCAST_STEPS.map((s) => <tr key={s.time}><td className="py-2 pr-4 font-mono">{s.time}</td><td className="py-2 pr-4">{s.show}</td><td className="py-2">{s.say}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section aria-label="Common rejections" className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">Common reasons for rejection</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-700">{REJECTION_RISKS.map((r) => <li key={r}>{r}</li>)}</ul>
        <p className="mt-3 text-xs text-ink-500">Review can take several rounds. Have a lawyer read the Privacy Policy and Terms before you submit; the built-in pages are a solid starting text, not legal advice.</p>
      </section>
    </div>
  );
}
