import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogHero } from "@/components/blog/blog-hero";
import { PostCard } from "@/components/blog/post-card";
import { JsonLd } from "@/components/seo/json-ld";
import { BLOG_CATEGORIES } from "@/lib/blog";
import { getPillar, listPublished } from "@/lib/data/blog";
import { breadcrumbLd } from "@/lib/seo";
import { siteBase } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

const find = (slug: string) => BLOG_CATEGORIES.find((c) => c.slug === slug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const category = find((await params).slug);
  if (!category) return {};
  const url = `${siteBase()}/blog/category/${category.slug}`;
  return { title: `${category.name}: Facebook Page Guides`, description: category.description, alternates: { canonical: url }, openGraph: { title: category.name, description: category.description, url, type: "website" } };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const category = find((await params).slug);
  if (!category) notFound();
  const [{ posts }, pillar] = await Promise.all([listPublished({ category: category.slug, perPage: 30 }), getPillar(category.slug)]);
  const others = posts.filter((p) => p.id !== pillar?.id);
  return (
    <>
      <JsonLd data={breadcrumbLd(siteBase(), [{ name: "Blog", path: "/blog" }, { name: category.name, path: `/blog/category/${category.slug}` }])} />
      <BlogHero title={category.name} subtitle={category.description} active={category.slug} />
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        {pillar ? (
          <div className="mb-10">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Start here</p>
            <PostCard post={pillar} large />
          </div>
        ) : null}
        {others.length > 0 ? (
          <>
            <h2 className="mb-5 font-display text-xl font-bold">More in {category.name}</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </>
        ) : null}
        {posts.length === 0 ? <p className="rounded-2xl border border-ink-100 bg-white p-8 text-center text-ink-600">No articles here yet. <Link href="/blog" className="font-semibold text-brand hover:underline">See all articles</Link>.</p> : null}
      </section>
    </>
  );
}
