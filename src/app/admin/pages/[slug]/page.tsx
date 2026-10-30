import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resetPageAction, restoreVersionAction, savePageAction } from "@/app/admin/pages/actions";
import { PendingButton } from "@/components/ui/pending-button";
import { PageHeader } from "@/components/ui/page-header";
import { getSitePage, listPageVersions } from "@/lib/data/site-pages";
import { EDITABLE_PAGES, PAGE_TOKEN_HELP, defaultPage, isPageSlug } from "@/lib/site-pages";

export const metadata: Metadata = { title: "Edit page" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const NOTICES: Record<string, string> = { saved: "Saved. The page is live.", reset: "The page now shows its built-in text.", restored: "Version restored." };
const input = "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";
const label = "block text-xs font-semibold uppercase tracking-wide text-ink-500";

export default async function EditPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!isPageSlug(slug)) notFound();
  const sp = await searchParams;
  const meta = EDITABLE_PAGES.find((p) => p.slug === slug)!;
  const [saved, versions] = await Promise.all([getSitePage(slug), listPageVersions(slug)]);
  const current = saved ?? defaultPage(slug);
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const error = typeof sp.error === "string" ? sp.error.slice(0, 200) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit: ${meta.label}`} description={saved ? "This page shows your saved text." : "This page shows the built-in text. Saving replaces it with your text."} />
      <p>
        <Link href="/admin/pages" className="text-sm font-semibold text-brand hover:underline">
          Back to all pages
        </Link>{" "}
        ·{" "}
        <Link href={meta.path} target="_blank" className="text-sm font-semibold text-brand hover:underline">
          View the page
        </Link>
      </p>
      {notice ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <form action={savePageAction} className="space-y-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <input type="hidden" name="slug" value={slug} />
        <label className={label}>
          Title
          <input name="title" required maxLength={120} defaultValue={current.title} className={input} />
        </label>
        <label className={label}>
          Introduction (optional)
          <textarea name="intro" rows={2} maxLength={600} defaultValue={current.intro} className={input} />
        </label>
        <label className={label}>
          Page text
          <textarea name="body" required rows={28} maxLength={60000} defaultValue={current.body} className={`${input} font-mono`} spellCheck />
        </label>
        <details className="rounded-xl bg-ink-50 p-4 text-sm text-ink-700">
          <summary className="cursor-pointer font-semibold">How to format the text</summary>
          <div className="mt-3 space-y-2">
            <p>
              <code>## Heading</code>, <code>### Smaller heading</code>, a blank line between paragraphs, <code>- item</code> for bullets, <code>1. item</code> for numbers, <code>**bold**</code>, <code>*italic*</code>, and <code>[link text](https://example.com)</code>. Links to this site start with <code>/</code>, for example <code>[Privacy](/privacy)</code>. No HTML.
            </p>
            <p className="font-semibold">Placeholders that fill in automatically:</p>
            <ul className="list-disc pl-5">
              {PAGE_TOKEN_HELP.map((t) => (
                <li key={t.token}>
                  <code>{t.token}</code>: {t.meaning}
                </li>
              ))}
            </ul>
          </div>
        </details>
        <p className="text-xs text-ink-500">English only. Policy pages are legal text: have them checked by someone qualified before you change what they promise.</p>
        <PendingButton pendingLabel="Saving…" variant="primary">Save page</PendingButton>
      </form>

      {saved ? (
        <form action={resetPageAction} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <input type="hidden" name="slug" value={slug} />
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
                <span>
                  {new Date(v.saved_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC · {v.body.length.toLocaleString("en-US")} characters
                </span>
                <form action={restoreVersionAction}>
                  <input type="hidden" name="slug" value={slug} />
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
