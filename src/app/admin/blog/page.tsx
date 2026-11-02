import type { Metadata } from "next";
import Link from "next/link";
import { importSeedAction, newPostAction } from "@/app/admin/blog/actions";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { SEED_ARTICLES } from "@/content/blog-seed";
import { BLOG_CATEGORIES } from "@/lib/blog";
import { listAllPosts } from "@/lib/data/blog";

export const metadata: Metadata = { title: "Blog" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BlogAdminPage({ searchParams }: Props) {
  const sp = await searchParams;
  let posts: Awaited<ReturnType<typeof listAllPosts>> | null = null;
  try {
    posts = await listAllPosts();
  } catch {
    posts = null;
  }
  const notice = typeof sp.notice === "string" ? sp.notice.slice(0, 250) : undefined;
  const error = typeof sp.error === "string" ? sp.error.slice(0, 250) : undefined;
  const slugs = new Set((posts ?? []).map((p) => p.slug));
  const waiting = SEED_ARTICLES.filter((a) => !slugs.has(a.slug)).length;
  const now = Date.now();

  return (
    <div className="space-y-6">
      <PageHeader title="Blog" description="Write, edit, and publish articles. English only (American English)." />
      {notice ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <form action={newPostAction}>
          <PendingButton pendingLabel="Creating…" variant="primary">New article</PendingButton>
        </form>
        {waiting > 0 ? (
          <form action={importSeedAction} className="flex items-center gap-3">
            <PendingButton pendingLabel="Adding…">Add {waiting} starter article{waiting === 1 ? "" : "s"}</PendingButton>
            <span className="text-sm text-ink-600">Ready-written drafts. Nothing goes live until you publish.</span>
          </form>
        ) : null}
        <Link href="/blog" target="_blank" className="text-sm font-semibold text-brand hover:underline">View the blog</Link>
      </div>

      {posts === null ? (
        <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">The blog is not available. Check that migration 0022 was run.</p>
      ) : posts.length === 0 ? (
        <p className="rounded-2xl border border-ink-100 bg-white p-8 text-center text-ink-600">No articles yet. Add the starter articles or write a new one.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Article</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Photo</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {posts.map((p) => {
                const live = p.status === "published" && p.published_at && new Date(p.published_at).getTime() <= now;
                const scheduled = p.status === "published" && !live;
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/blog/${p.id}`} className="font-semibold text-ink hover:text-brand">{p.title}</Link>
                      <p className="text-xs text-ink-500">/blog/{p.slug}{p.is_pillar ? " · pillar guide" : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{BLOG_CATEGORIES.find((c) => c.slug === p.category_slug)?.name ?? "None"}</td>
                    <td className="px-4 py-3"><Badge tone={live ? "green" : scheduled ? "amber" : "neutral"}>{live ? "Published" : scheduled ? "Scheduled" : "Draft"}</Badge></td>
                    <td className="px-4 py-3 text-ink-600">{p.featured ? "Yes" : "None"}</td>
                    <td className="px-4 py-3 text-ink-600">{new Date(p.updated_at).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-ink-500">Open an article to edit it, find its photos, check the SEO list, and publish.</p>
    </div>
  );
}
