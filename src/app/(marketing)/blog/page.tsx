import type { Metadata } from "next";
import Link from "next/link";
import { BlogHero } from "@/components/blog/blog-hero";
import { PostCard } from "@/components/blog/post-card";
import { JsonLd } from "@/components/seo/json-ld";
import { pageCount } from "@/lib/blog";
import { listPublished } from "@/lib/data/blog";
import { breadcrumbLd } from "@/lib/seo";
import { pageMetadata, siteBase } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
  const base = await pageMetadata("/blog");
  const page = Number((await searchParams).page ?? "1");
  return page > 1 ? { ...base, robots: { index: false, follow: true } } : base;
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Math.min(100, Number((await searchParams).page ?? "1") || 1));
  const { posts, total } = await listPublished({ page });
  const pages = pageCount(total);
  const [first, ...rest] = posts;

  return (
    <>
      <JsonLd data={breadcrumbLd(siteBase(), [{ name: "Blog", path: "/blog" }])} />
      <BlogHero title="Facebook content, explained simply" subtitle="Practical guides on planning, writing, and scheduling Facebook Page posts, for small businesses and the people who run their pages." />
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        {posts.length === 0 ? (
          <p className="rounded-2xl border border-ink-100 bg-white p-8 text-center text-ink-600">New articles are on the way. In the meantime, try our <Link href="/tools" className="font-semibold text-brand hover:underline">free tools</Link>.</p>
        ) : (
          <>
            {page === 1 && first ? <PostCard post={first} large /> : null}
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {(page === 1 ? rest : posts).map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
            {pages > 1 ? (
              <nav aria-label="Pages" className="mt-12 flex items-center justify-center gap-3 text-sm">
                {page > 1 ? <Link href={page === 2 ? "/blog" : `/blog?page=${page - 1}`} rel="prev" className="rounded-xl border border-ink-200 px-4 py-2 font-medium hover:bg-ink-50">Newer</Link> : null}
                <span className="text-ink-600">Page {page} of {pages}</span>
                {page < pages ? <Link href={`/blog?page=${page + 1}`} rel="next" className="rounded-xl border border-ink-200 px-4 py-2 font-medium hover:bg-ink-50">Older</Link> : null}
              </nav>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
