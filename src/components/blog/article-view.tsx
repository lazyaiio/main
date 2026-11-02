import Link from "next/link";
import { MarkdownContent, type ArticleImage } from "@/components/marketing/markdown-content";
import { PostCard, categoryName, formatDate } from "@/components/blog/post-card";
import { JsonLd } from "@/components/seo/json-ld";
import { BLOG_CATEGORIES, countWords, extractImageIds, readingMinutes } from "@/lib/blog";
import { getImages, type BlogPost, type PostCard as PostCardData, type PublicImage } from "@/lib/data/blog";
import { parseMarkdown, tableOfContents } from "@/lib/markdown";
import { blogPostingLd, breadcrumbLd } from "@/lib/seo";
import { loadSeo, siteBase } from "@/lib/services/seo";

const TOOL_FOR_CATEGORY: Record<string, { href: string; label: string; text: string }> = {
  "content-planning": { href: "/tools/content-calendar-generator", label: "Free content calendar generator", text: "Turn this guide into a ready-to-use calendar in a minute." },
  "writing-posts": { href: "/tools/post-checker", label: "Free Facebook post checker", text: "Paste a draft and see how it reads before you publish." },
  "scheduling-and-ai": { href: "/tools/post-idea-generator", label: "Free Facebook post idea generator", text: "Get a dozen post ideas for your kind of business." },
};

/** One article page. Used for the public page and for the admin preview. */
export async function ArticleView({ post, featured, related, pillar, preview = false }: { post: BlogPost; featured: PublicImage | null; related: PostCardData[]; pillar: PostCardData | null; preview?: boolean }) {
  const blocks = parseMarkdown(post.body);
  const toc = tableOfContents(blocks);
  const ids = extractImageIds(post.body);
  const rows = await getImages(ids);
  const images: Record<string, ArticleImage> = Object.fromEntries(Object.entries(rows).map(([id, r]) => [id, { url: r.url, width: r.width, height: r.height, alt: r.alt, credit: r.credit, creditUrl: r.creditUrl, sourceUrl: r.sourceUrl }]));
  const words = countWords(post.body);
  const category = BLOG_CATEGORIES.find((c) => c.slug === post.category_slug) ?? null;
  const tool = post.category_slug ? TOOL_FOR_CATEGORY[post.category_slug] : undefined;
  const { settings } = await loadSeo();
  const base = siteBase();
  const url = `${base}/blog/${post.slug}`;
  const ld = [
    blogPostingLd(base, settings, { url, title: post.title, description: post.meta_description || post.excerpt, image: featured?.url ?? null, published: post.published_at, modified: post.updated_at, author: post.author_name, words }),
    breadcrumbLd(base, [{ name: "Blog", path: "/blog" }, ...(category ? [{ name: category.name, path: `/blog/category/${category.slug}` }] : []), { name: post.title, path: `/blog/${post.slug}` }]),
  ];

  return (
    <article>
      {preview ? null : <JsonLd data={ld} />}
      <header className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto w-full max-w-4xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-600">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li><Link href="/blog" className="hover:underline">Blog</Link></li>
              {category ? (
                <li className="flex items-center gap-1.5"><span aria-hidden="true">/</span><Link href={`/blog/category/${category.slug}`} className="hover:underline">{category.name}</Link></li>
              ) : null}
            </ol>
          </nav>
          <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">{post.title}</h1>
          {post.excerpt ? <p className="mt-4 text-lg leading-relaxed text-ink-600">{post.excerpt}</p> : null}
          <p className="mt-5 text-sm text-ink-600">
            By {post.author_name} · {formatDate(post.published_at ?? post.updated_at)} · {readingMinutes(words)} min read
            {post.updated_at && post.published_at && new Date(post.updated_at).getTime() - new Date(post.published_at).getTime() > 7 * 86_400_000 ? ` · Updated ${formatDate(post.updated_at)}` : ""}
          </p>
        </div>
        {featured ? (
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={featured.url} alt={featured.alt || post.title} width={featured.width} height={featured.height} fetchPriority="high" decoding="async" className="h-auto max-h-[34rem] w-full rounded-2xl object-cover shadow-soft" />
            {featured.credit ? (
              <p className="mt-2 text-xs text-ink-500">
                {featured.sourceUrl ? <a href={featured.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{featured.credit}</a> : featured.credit}
              </p>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        {pillar && !post.is_pillar ? (
          <p className="mb-8 rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-700">
            Part of our guide: <Link href={`/blog/${pillar.slug}`} className="font-semibold text-brand hover:underline">{pillar.title}</Link>
          </p>
        ) : null}
        {toc.length >= 3 ? (
          <nav aria-label="In this article" className="mb-10 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <p className="font-display text-base font-bold">In this article</p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
              {toc.map((t) => (
                <li key={t.id}><a href={`#${t.id}`} className="text-brand hover:underline">{t.label}</a></li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="space-y-5 text-[1.0625rem] leading-8 text-ink-700 [&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_code]:text-sm [&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-snug [&_h2]:text-ink [&_h3]:mt-8 [&_h3]:scroll-mt-24 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-ink [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
          <MarkdownContent blocks={blocks} images={images} />
        </div>

        {post.tags.length > 0 ? (
          <ul className="mt-10 flex flex-wrap gap-2" aria-label="Tags">
            {post.tags.map((t) => (
              <li key={t} className="rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-700">{t}</li>
            ))}
          </ul>
        ) : null}

        <aside className="mt-12 rounded-3xl bg-ink p-8 text-white">
          <h2 className="font-display text-2xl font-bold">Plan, write, and schedule your Facebook posts with LazyAI</h2>
          <p className="mt-2 text-ink-200">Give LazyAI a topic or a website. Get a content plan and posts you can edit, then schedule them to your Facebook Page.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/pricing" className="inline-flex h-11 items-center rounded-xl bg-white px-5 text-sm font-semibold text-ink hover:bg-ink-100">Start free</Link>
            {tool ? <Link href={tool.href} className="inline-flex h-11 items-center rounded-xl border border-white/40 px-5 text-sm font-semibold text-white hover:bg-white/10">{tool.label}</Link> : null}
          </div>
          {tool ? <p className="mt-3 text-sm text-ink-200">{tool.text}</p> : null}
        </aside>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related" className="border-t border-ink-100 bg-ink-50">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <h2 id="related" className="font-display text-2xl font-bold">Keep reading</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {related.map((r) => (
                <PostCard key={r.id} post={r} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </article>
  );
}

export { categoryName };
