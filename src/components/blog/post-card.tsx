import Link from "next/link";
import { BLOG_CATEGORIES, countWords, readingMinutes } from "@/lib/blog";
import type { PostCard as PostCardData } from "@/lib/data/blog";

export const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" }) : "");
export const categoryName = (slug: string | null) => BLOG_CATEGORIES.find((c) => c.slug === slug)?.name ?? null;

/** A card with the article's thumbnail, category, title, summary, date. */
export function PostCard({ post, large = false }: { post: PostCardData; large?: boolean }) {
  const category = categoryName(post.category_slug);
  return (
    <article className={`group overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card transition-shadow hover:shadow-soft ${large ? "md:grid md:grid-cols-2" : "flex flex-col"}`}>
      <Link href={`/blog/${post.slug}`} className={`block overflow-hidden bg-ink-100 ${large ? "md:h-full" : ""}`} tabIndex={-1} aria-hidden="true">
        {post.featured ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.featured.thumbUrl}
            alt=""
            width={post.featured.width}
            height={post.featured.height}
            loading={large ? "eager" : "lazy"}
            decoding="async"
            className={`w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${large ? "h-64 md:h-full" : "aspect-[16/10]"}`}
          />
        ) : (
          <div className={`w-full bg-gradient-to-br from-brand-50 to-brand-100 ${large ? "h-64 md:h-full" : "aspect-[16/10]"}`} />
        )}
      </Link>
      <div className={`flex flex-1 flex-col p-5 ${large ? "md:p-8" : ""}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {category ? <span className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-700">{category}</span> : null}
          {post.is_pillar ? <span className="rounded-full bg-ink px-2.5 py-1 font-semibold text-white">Guide</span> : null}
        </div>
        <h2 className={`mt-3 font-display font-bold leading-snug text-ink ${large ? "text-2xl md:text-3xl" : "text-lg"}`}>
          <Link href={`/blog/${post.slug}`} className="hover:text-brand">
            {post.title}
          </Link>
        </h2>
        <p className={`mt-2 flex-1 text-ink-600 ${large ? "text-base" : "text-sm"}`}>{post.excerpt}</p>
        <p className="mt-4 text-xs text-ink-500">
          {formatDate(post.published_at)} · {post.author_name}
        </p>
      </div>
    </article>
  );
}

export { countWords, readingMinutes };
