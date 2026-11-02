import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePostAction, findPhotosAction, savePostAction, choosePhotoAction } from "@/app/admin/blog/actions";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { BLOG_CATEGORIES, countWords, extractImageIds, findPlaceholders, postChecklist, readingMinutes } from "@/lib/blog";
import { getImages, getPostById } from "@/lib/data/blog";
import { searchBlogPhotos } from "@/lib/services/blog-images";

export const metadata: Metadata = { title: "Edit article" };
export const dynamic = "force-dynamic";
// Finding photos downloads and saves several pictures in one request.
export const maxDuration = 60;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const input = "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";
const label = "block text-xs font-semibold uppercase tracking-wide text-ink-500";
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function EditArticlePage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const post = await getPostById(id);
  if (!post) notFound();
  const sp = await searchParams;
  const notice = str(sp.notice).slice(0, 250);
  const error = str(sp.error).slice(0, 250);
  const q = str(sp.q).trim().slice(0, 100);
  const mode = ["featured", "add", "replace"].includes(str(sp.mode)) ? str(sp.mode) : "add";
  const target = /^[0-9a-f-]{36}$/.test(str(sp.target)) ? str(sp.target) : "";

  const imageIds = extractImageIds(post.body);
  const imagesById = await getImages([...imageIds, ...(post.featured_image_id ? [post.featured_image_id] : [])]);
  const featured = post.featured_image_id ? imagesById[post.featured_image_id] : null;
  const placeholders = findPlaceholders(post.body);
  const words = countWords(post.body);
  const checklist = postChecklist({ title: post.title, slug: post.slug, seoTitle: post.seo_title, metaDescription: post.meta_description, excerpt: post.excerpt, body: post.body, focusKeyword: post.focus_keyword, hasFeaturedImage: Boolean(post.featured_image_id) });
  const live = post.status === "published" && post.published_at && new Date(post.published_at).getTime() <= Date.now();
  const scheduled = post.status === "published" && !live;

  let results: Awaited<ReturnType<typeof searchBlogPhotos>> = [];
  let searchError = "";
  if (q) {
    try {
      results = await searchBlogPhotos(q, 18);
    } catch (e) {
      searchError = e instanceof Error ? e.message : "The search failed.";
    }
  }
  const here = `/admin/blog/${id}`;
  const warns = checklist.filter((c) => c.level === "warn").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Edit article" description={`${words.toLocaleString("en-US")} words · ${readingMinutes(words)} min read · ${live ? "Published" : scheduled ? "Scheduled" : "Draft"}`} />
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/admin/blog" className="font-semibold text-brand hover:underline">Back to all articles</Link>
        <Link href={`${here}/preview`} target="_blank" className="font-semibold text-brand hover:underline">Preview</Link>
        {live ? <Link href={`/blog/${post.slug}`} target="_blank" className="font-semibold text-brand hover:underline">View live</Link> : null}
      </p>
      {notice ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <form action={savePostAction} className="space-y-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <input type="hidden" name="id" value={post.id} />
          <label className={label}>Title<input name="title" required maxLength={140} defaultValue={post.title} className={input} /></label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={label}>Address (slug)<input name="slug" required maxLength={90} defaultValue={post.slug} className={input} /><span className="mt-1 block text-xs font-normal normal-case tracking-normal text-ink-500">/blog/{post.slug}</span></label>
            <label className={label}>Focus keyword<input name="focusKeyword" maxLength={80} defaultValue={post.focus_keyword} className={input} placeholder="the phrase to rank for" /></label>
            <label className={label}>Category
              <select name="category" defaultValue={post.category_slug ?? ""} className={input}>
                <option value="">Choose…</option>
                {BLOG_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </label>
            <label className={label}>Author<input name="authorName" maxLength={80} defaultValue={post.author_name} className={input} /></label>
            <label className={label}>Tags (comma separated, up to 8)<input name="tags" defaultValue={post.tags.join(", ")} className={input} /></label>
            <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" name="isPillar" defaultChecked={post.is_pillar} className="h-4 w-4 accent-brand" /> Pillar guide for its category (one per category)</label>
          </div>
          <label className={label}>Search title (optional, up to 70)<input name="seoTitle" maxLength={70} defaultValue={post.seo_title} className={input} placeholder={post.title} /></label>
          <label className={label}>Search description ({post.meta_description.length}/160 best)<textarea name="metaDescription" rows={2} maxLength={200} defaultValue={post.meta_description} className={input} /></label>
          <label className={label}>Short summary for the cards<textarea name="excerpt" rows={2} maxLength={320} defaultValue={post.excerpt} className={input} /></label>
          <label className={label}>Article text (Markdown)
            <textarea name="body" required rows={32} defaultValue={post.body} spellCheck className={`${input} font-mono leading-6`} />
          </label>
          <details className="rounded-xl bg-ink-50 p-4 text-sm text-ink-700">
            <summary className="cursor-pointer font-semibold">Formatting help</summary>
            <p className="mt-2"><code>## Main heading</code>, <code>### Smaller heading</code>, blank line between paragraphs, <code>- bullet</code>, <code>1. number</code>, <code>**bold**</code>, <code>*italic*</code>, <code>&gt; a tip or quote</code>, and <code>[link text](/blog/another-article)</code>. A picture is one line: <code>![what it shows](blog-image:ID)</code>. A line like <code>[[image: search words | what it shows]]</code> is a placeholder that the &ldquo;Find the photos&rdquo; button replaces with a stock photo. No HTML.</p>
          </details>
          <div className="flex flex-wrap items-end gap-3 border-t border-ink-100 pt-4">
            <PendingButton pendingLabel="Saving…">Save draft</PendingButton>
            <button name="intent" value="publish" type="submit" className="h-10 rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-600">{live ? "Save and keep published" : "Publish now"}</button>
            {live || scheduled ? <button name="intent" value="unpublish" type="submit" className="h-10 rounded-xl border border-ink-300 px-5 text-sm font-semibold text-ink hover:bg-ink-50">Take offline</button> : null}
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Or schedule (UTC)
              <input type="datetime-local" name="publishAt" className="mt-1 block rounded-xl border border-ink-200 px-3 py-2 text-sm font-normal normal-case text-ink" />
            </label>
            <button name="intent" value="schedule" type="submit" className="h-10 rounded-xl border border-ink-300 px-5 text-sm font-semibold text-ink hover:bg-ink-50">Schedule</button>
          </div>
        </form>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <h2 className="font-display text-base font-bold">SEO checklist</h2>
            <p className="text-xs text-ink-600">{warns === 0 ? "All checks pass." : `${warns} to look at. Save to refresh.`}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {checklist.map((c) => (
                <li key={c.label} className="flex gap-2">
                  <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${c.level === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`} aria-label={c.level === "ok" ? "Good" : "Check"}>{c.level === "ok" ? "✓" : "!"}</span>
                  <span><span className="font-medium text-ink">{c.label}</span><span className="block text-xs text-ink-600">{c.detail}</span></span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <h2 className="font-display text-base font-bold">Photos</h2>
            {featured ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Featured image</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={featured.thumbUrl} alt={featured.alt || "Featured image"} className="mt-1 aspect-[16/10] w-full rounded-lg object-cover" />
                <p className="mt-1 text-xs text-ink-500">{featured.credit}</p>
              </div>
            ) : <p className="text-sm text-amber-800">No featured image yet.</p>}
            <form action={findPhotosAction}>
              <input type="hidden" name="id" value={post.id} />
              <PendingButton pendingLabel="Finding photos… (up to a minute)">Find the photos{placeholders.length > 0 ? ` (${placeholders.length} waiting)` : ""}</PendingButton>
              <p className="mt-1 text-xs text-ink-500">Fills every <code>[[image: …]]</code> spot and the featured image from Pixabay and Unsplash.</p>
            </form>
            {imageIds.length > 0 ? (
              <ul className="space-y-2">
                {imageIds.map((iid) => {
                  const img = imagesById[iid];
                  return img ? (
                    <li key={iid} className="flex items-center gap-3 text-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.thumbUrl} alt="" className="h-12 w-16 rounded object-cover" />
                      <span className="min-w-0 flex-1 truncate" title={img.alt}>{img.alt || "Picture"}</span>
                      <Link href={`${here}?mode=replace&target=${iid}&q=${encodeURIComponent((img.alt || post.focus_keyword || post.title).slice(0, 60))}#search`} className="font-semibold text-brand hover:underline">Replace</Link>
                    </li>
                  ) : null;
                })}
              </ul>
            ) : null}
          </section>

          <section id="search" className="space-y-3 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <h2 className="font-display text-base font-bold">Search stock photos</h2>
            <form method="get" action={`${here}#search`} className="flex gap-2">
              <input type="hidden" name="mode" value={mode} />
              {target ? <input type="hidden" name="target" value={target} /> : null}
              <input name="q" defaultValue={q} placeholder="e.g. cafe owner planning" className={input} />
              <button type="submit" className="mt-1 h-10 shrink-0 rounded-xl border border-ink-300 px-4 text-sm font-semibold hover:bg-ink-50">Search</button>
            </form>
            <p className="text-xs text-ink-500">Chosen photo will be used {mode === "featured" ? "as the featured image" : mode === "replace" ? "in place of the picture you picked" : "at the end of the article"}. {mode !== "featured" ? <Link href={`${here}?mode=featured&q=${encodeURIComponent(q)}#search`} className="font-semibold text-brand hover:underline">Use as featured instead</Link> : <Link href={`${here}?mode=add&q=${encodeURIComponent(q)}#search`} className="font-semibold text-brand hover:underline">Add to the text instead</Link>}</p>
            {searchError ? <p role="alert" className="text-sm text-red-700">{searchError}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              {results.map((r) => (
                <form key={`${r.providerKey}:${r.providerId}`} action={choosePhotoAction} className="space-y-1">
                  <input type="hidden" name="id" value={post.id} />
                  <input type="hidden" name="photoRef" value={`${r.providerKey}:${r.providerId}`} />
                  <input type="hidden" name="mode" value={mode} />
                  <input type="hidden" name="target" value={target} />
                  <input type="hidden" name="alt" value={q} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.previewUrl} alt={r.alt || "Stock photo"} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" />
                  <PendingButton pendingLabel="Adding…">Use · {r.providerName}</PendingButton>
                </form>
              ))}
            </div>
          </section>

          <form action={deletePostAction} className="rounded-2xl border border-red-100 bg-white p-5">
            <input type="hidden" name="id" value={post.id} />
            <p className="mb-2 text-sm text-ink-600">Delete this article for good. Its photos stay in the library.</p>
            <PendingButton pendingLabel="Deleting…">Delete article</PendingButton>
          </form>
        </aside>
      </div>
    </div>
  );
}
