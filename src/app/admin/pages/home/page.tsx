import type { Metadata } from "next";
import Link from "next/link";
import { resetPageAction, restoreVersionAction, saveHomeAction } from "@/app/admin/pages/actions";
import { PendingButton } from "@/components/ui/pending-button";
import { PageHeader } from "@/components/ui/page-header";
import { getSitePage, listPageVersions } from "@/lib/data/site-pages";
import { formatPairLines, normalizeHome } from "@/lib/home-content";

export const metadata: Metadata = { title: "Edit home page" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const input = "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";
const label = "block text-xs font-semibold uppercase tracking-wide text-ink-500";
const NOTICES: Record<string, string> = { saved: "Saved. The home page is live.", reset: "The home page now shows its built-in text.", restored: "Version restored." };

export default async function EditHomePage({ searchParams }: Props) {
  const sp = await searchParams;
  const [saved, versions] = await Promise.all([getSitePage("home"), listPageVersions("home")]);
  const c = normalizeHome(saved?.data);
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const error = typeof sp.error === "string" ? sp.error.slice(0, 200) : undefined;
  const text = (name: string, title: string, value: string, max = 160) => (
    <label className={label}>
      {title}
      <input name={name} required maxLength={max} defaultValue={value} className={input} />
    </label>
  );
  const area = (name: string, title: string, value: string, hint: string, rows = 6) => (
    <label className={label}>
      {title}
      <textarea name={name} required rows={rows} defaultValue={value} className={input} />
      <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-ink-500">{hint}</span>
    </label>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Edit: Home page" description={saved ? "The home page shows your saved text." : "The home page shows the built-in text. Saving replaces it with your text."} />
      <p>
        <Link href="/admin/pages" className="text-sm font-semibold text-brand hover:underline">Back to all pages</Link> ·{" "}
        <Link href="/" target="_blank" className="text-sm font-semibold text-brand hover:underline">View the home page</Link>
      </p>
      {notice ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <form action={saveHomeAction} className="space-y-8 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <section className="space-y-4">
          <h2 className="font-display text-lg font-bold">Top of the page</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {text("hero_badge", "Small label above the title", c.hero.badge)}
            {text("hero_titleLead", "Title, first part", c.hero.titleLead)}
            {text("hero_titleAccent", "Title, colored part", c.hero.titleAccent)}
            {text("hero_primaryCta", "Main button", c.hero.primaryCta, 40)}
            {text("hero_secondaryCta", "Second button", c.hero.secondaryCta, 40)}
          </div>
          {area("hero_subtitle", "Subtitle", c.hero.subtitle, "One or two sentences.", 3)}
          {area("hero_reassurances", "Reassurance lines", c.hero.reassurances.join("\n"), "One line each, up to 6.", 4)}
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-bold">How it works</h2>
          {text("how_title", "Section title", c.how.title)}
          {area("how_steps", "Steps", formatPairLines(c.how.steps), "One step per line, written as: Step title | Short description", 5)}
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-bold">Features</h2>
          {text("features_title", "Section title", c.features.title)}
          {area("features_items", "Features", formatPairLines(c.features.items), "One per line, written as: Feature title | Short description. Up to 12. The icons are chosen in order.", 9)}
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-bold">Questions and answers</h2>
          {text("faq_title", "Section title", c.faq.title)}
          {area("faq_items", "Questions", c.faq.items.map((i) => `${i.q} | ${i.a}`).join("\n"), "One per line, written as: Question | Answer. Up to 12.", 9)}
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-bold">Bottom banner</h2>
          {text("cta_title", "Title", c.cta.title)}
          {text("cta_subtitle", "Text", c.cta.subtitle, 600)}
          {text("cta_button", "Button", c.cta.button, 40)}
        </section>

        <p className="text-xs text-ink-500">English only. The pipe character ( | ) separates a title from its text, so do not use it inside a title or question.</p>
        <PendingButton pendingLabel="Saving…" variant="primary">Save home page</PendingButton>
      </form>

      {saved ? (
        <form action={resetPageAction} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <input type="hidden" name="slug" value="home" />
          <p className="mb-3 text-sm text-ink-600">Go back to the text that came with the site. Your saved versions stay in the list below.</p>
          <PendingButton pendingLabel="Resetting…">Use the built-in text</PendingButton>
        </form>
      ) : null}

      {versions.length > 0 ? (
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="font-display text-lg font-bold">Earlier versions</h2>
          <ul className="mt-3 divide-y divide-ink-100 text-sm">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{new Date(v.saved_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</span>
                <form action={restoreVersionAction}>
                  <input type="hidden" name="slug" value="home" />
                  <input type="hidden" name="versionId" value={v.id} />
                  <PendingButton pendingLabel="Restoring…">Restore</PendingButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
