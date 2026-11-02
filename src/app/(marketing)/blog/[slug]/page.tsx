import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/blog/article-view";
import { pickRelated } from "@/lib/blog";
import { featuredFor, getPillar, getPublishedBySlug, listPublishedMeta } from "@/lib/data/blog";
import { siteBase } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPublishedBySlug((await params).slug);
  if (!post) return {};
  const featured = await featuredFor(post);
  const url = `${siteBase()}/blog/${post.slug}`;
  const title = post.seo_title || post.title;
  const description = post.meta_description || post.excerpt;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", title, description, url, siteName: "LazyAI", locale: "en_US", publishedTime: post.published_at ?? undefined, modifiedTime: post.updated_at, authors: [post.author_name], tags: post.tags, ...(featured ? { images: [{ url: featured.url, width: featured.width, height: featured.height, alt: featured.alt || post.title }] } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(featured ? { images: [featured.url] } : {}) },
  };
}

export default async function ArticlePage({ params }: Props) {
  const post = await getPublishedBySlug((await params).slug);
  if (!post) notFound();
  const [featured, all, pillar] = await Promise.all([featuredFor(post), listPublishedMeta(), post.category_slug ? getPillar(post.category_slug) : Promise.resolve(null)]);
  const meta = { slug: post.slug, categorySlug: post.category_slug, tags: post.tags, isPillar: post.is_pillar, publishedAt: post.published_at };
  const related = pickRelated(meta, all.map((p) => ({ ...p, slug: p.slug, categorySlug: p.category_slug, tags: p.tags, isPillar: p.is_pillar, publishedAt: p.published_at })), 3);
  return <ArticleView post={post} featured={featured} related={related} pillar={pillar} />;
}
