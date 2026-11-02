import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/blog/article-view";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { pickRelated } from "@/lib/blog";
import { featuredFor, getPillar, getPostById, listPublishedMeta } from "@/lib/data/blog";

export const metadata: Metadata = { title: "Article preview", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The article exactly as readers will see it, even while it is a draft. Only platform admins can open it. */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const post = await getPostById(id);
  if (!post) notFound();
  const [featured, all, pillar] = await Promise.all([featuredFor(post), listPublishedMeta(), post.category_slug ? getPillar(post.category_slug) : Promise.resolve(null)]);
  const related = pickRelated({ slug: post.slug, categorySlug: post.category_slug, tags: post.tags, isPillar: post.is_pillar, publishedAt: post.published_at }, all.map((p) => ({ ...p, categorySlug: p.category_slug, isPillar: p.is_pillar, publishedAt: p.published_at })), 3);
  return (
    <div className="bg-white">
      <p className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">Preview{post.status === "published" ? "" : ": this article is not public yet"}</p>
      <ArticleView post={post} featured={featured} related={related} pillar={pillar} preview />
    </div>
  );
}
