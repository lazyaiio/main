import "server-only";
import { BLOG_CATEGORIES, countWords, findPlaceholders, imageLine, replaceFirstPlaceholder, validatePost, validatePublish, type PostInput } from "@/lib/blog";
import { SEED_ARTICLES } from "@/content/blog-seed";
import { createPost, existingSlugs, getPostById, updatePost, usedSourcePages } from "@/lib/data/blog";
import { autoPhoto, importStockPhotoForBlog } from "./blog-images";

export type FindPhotosResult = { added: number; missing: number; featured: boolean; message: string };

/** Creates the built-in starter articles that are not in the blog yet, as drafts (nothing is published). */
export async function importSeedArticles(userId: string): Promise<{ created: number; skipped: number }> {
  const have = await existingSlugs();
  let created = 0;
  let skipped = 0;
  for (const a of SEED_ARTICLES) {
    if (have.has(a.slug)) {
      skipped++;
      continue;
    }
    const input: PostInput = { title: a.title, slug: a.slug, seoTitle: a.seoTitle, metaDescription: a.metaDescription, excerpt: a.excerpt, body: a.body, categorySlug: a.category, focusKeyword: a.focusKeyword, authorName: "LazyAI Team" };
    if (validatePost(input)) {
      skipped++;
      continue;
    }
    try {
      await createPost(
        { slug: a.slug, title: a.title, seo_title: a.seoTitle, meta_description: a.metaDescription, excerpt: a.excerpt, body: a.body, category_slug: a.category, tags: [...a.tags], is_pillar: a.isPillar, focus_keyword: a.focusKeyword, author_name: "LazyAI Team", status: "draft" },
        userId,
      );
      created++;
    } catch {
      skipped++; // for example a second pillar in the same category
    }
  }
  return { created, skipped };
}

/**
 * Finds photos for every [[image: …]] placeholder in an article, and a featured image when it has none.
 * The searches run first (in parallel is not needed: the providers answer fast), then each chosen photo is saved.
 */
export async function findPhotosForPost(postId: string, userId: string): Promise<FindPhotosResult> {
  const post = await getPostById(postId);
  if (!post) return { added: 0, missing: 0, featured: false, message: "Article not found." };
  const seed = SEED_ARTICLES.find((s) => s.slug === post.slug);
  const used = await usedSourcePages();
  let body = post.body;
  let added = 0;
  let missing = 0;
  let featuredId: string | null = post.featured_image_id;
  let featuredSet = false;

  const topic = post.focus_keyword || post.title;
  const startedAt = Date.now();
  const timeLeft = () => 50_000 - (Date.now() - startedAt);

  if (!featuredId) {
    const query = seed?.featuredQuery ?? topic;
    const photo = timeLeft() > 8000 ? await autoPhoto(query, topic, used) : null;
    if (photo) {
      try {
        featuredId = await importStockPhotoForBlog({ ...photo, alt: seed?.title ?? post.title });
        used.add(photo.sourcePageUrl);
        featuredSet = true;
      } catch {
        // The article can still get inline photos.
      }
    }
  }

  for (const placeholder of findPlaceholders(post.body)) {
    if (timeLeft() < 8000) {
      missing++;
      continue;
    }
    const photo = await autoPhoto(placeholder.query, topic, used);
    if (!photo) {
      missing++;
      continue;
    }
    try {
      const id = await importStockPhotoForBlog({ ...photo, alt: placeholder.alt });
      used.add(photo.sourcePageUrl);
      body = replaceFirstPlaceholder(body, placeholder.line, imageLine(placeholder.alt, id));
      added++;
    } catch {
      missing++;
    }
  }

  if (added > 0 || featuredSet) await updatePost(postId, { body, ...(featuredSet ? { featured_image_id: featuredId } : {}) }, userId);
  const message =
    added + (featuredSet ? 1 : 0) === 0
      ? "No photos were added. Check that a stock photo provider is on (Admin, Stock photos) and try again."
      : `Added ${added} picture${added === 1 ? "" : "s"}${featuredSet ? " and a featured image" : ""}.${missing > 0 ? ` ${missing} could not be found: run it again or choose them by hand.` : ""}`;
  return { added, missing, featured: featuredSet, message };
}

export function publishProblem(post: { title: string; slug: string; seo_title: string; meta_description: string; excerpt: string; body: string; category_slug: string | null; focus_keyword: string; author_name: string; featured_image_id: string | null }): string | null {
  return validatePublish({ title: post.title, slug: post.slug, seoTitle: post.seo_title, metaDescription: post.meta_description, excerpt: post.excerpt, body: post.body, categorySlug: post.category_slug ?? "", focusKeyword: post.focus_keyword, authorName: post.author_name, hasFeaturedImage: Boolean(post.featured_image_id) });
}

export { BLOG_CATEGORIES, countWords };
