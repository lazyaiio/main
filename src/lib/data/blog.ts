import "server-only";
import { adminDb } from "./platform";
import { DataError } from "./db";
import { POSTS_PER_PAGE, publicImageUrl } from "@/lib/blog";
import { getSupabasePublicEnv } from "@/lib/env";

/** The blog tables are server-only. Every function here uses the service key, so callers must check who is asking (admin pages) or return only published content (public pages). */

export type BlogCategory = { slug: string; name: string; description: string; sort_order: number };
export type BlogImage = {
  id: string; storage_path: string; thumb_path: string | null; width: number; height: number; alt_text: string;
  provider: string; creator: string; creator_url: string; source_page_url: string; license: string; license_url: string;
};
export type BlogPost = {
  id: string; slug: string; title: string; seo_title: string; meta_description: string; excerpt: string; body: string;
  category_slug: string | null; tags: string[]; is_pillar: boolean; focus_keyword: string; featured_image_id: string | null;
  author_name: string; status: "draft" | "published"; published_at: string | null; created_at: string; updated_at: string;
};
export type PostCard = Omit<BlogPost, "body"> & { featured: PublicImage | null };
export type PublicImage = { id: string; url: string; thumbUrl: string; width: number; height: number; alt: string; credit: string; creditUrl: string; sourceUrl: string };

const POST_COLUMNS = "id, slug, title, seo_title, meta_description, excerpt, body, category_slug, tags, is_pillar, focus_keyword, featured_image_id, author_name, status, published_at, created_at, updated_at";
const CARD_COLUMNS = POST_COLUMNS.replace(" body,", "");
const IMAGE_COLUMNS = "id, storage_path, thumb_path, width, height, alt_text, provider, creator, creator_url, source_page_url, license, license_url";

const db = () => adminDb();
const nowIso = () => new Date().toISOString();
const baseUrl = () => getSupabasePublicEnv()?.url ?? "";

export function toPublicImage(row: BlogImage): PublicImage {
  const credit = row.provider ? `Photo${row.creator ? ` by ${row.creator}` : ""} on ${row.provider}` : "";
  return {
    id: row.id,
    url: publicImageUrl(baseUrl(), row.storage_path),
    thumbUrl: publicImageUrl(baseUrl(), row.thumb_path ?? row.storage_path),
    width: row.width,
    height: row.height,
    alt: row.alt_text,
    credit,
    creditUrl: row.creator_url,
    sourceUrl: row.source_page_url,
  };
}

export async function listCategories(): Promise<BlogCategory[]> {
  const { data } = await db().from("blog_categories").select("slug, name, description, sort_order").order("sort_order");
  return (data ?? []) as BlogCategory[];
}

export async function getImages(ids: string[]): Promise<Record<string, PublicImage>> {
  if (ids.length === 0) return {};
  const { data } = await db().from("blog_images").select(IMAGE_COLUMNS).in("id", ids.slice(0, 60));
  return Object.fromEntries(((data ?? []) as BlogImage[]).map((r) => [r.id, toPublicImage(r)]));
}

export async function getImageRows(ids: string[]): Promise<BlogImage[]> {
  if (ids.length === 0) return [];
  const { data } = await db().from("blog_images").select(IMAGE_COLUMNS).in("id", ids.slice(0, 60));
  return (data ?? []) as BlogImage[];
}

export async function insertImage(row: Omit<BlogImage, "id">): Promise<string> {
  const { data, error } = await db().from("blog_images").insert(row).select("id").single();
  if (error || !data) throw new DataError("Could not save the image.", error?.code);
  return (data as { id: string }).id;
}

export async function usedSourcePages(): Promise<Set<string>> {
  const { data } = await db().from("blog_images").select("source_page_url").limit(2000);
  return new Set(((data ?? []) as { source_page_url: string }[]).map((r) => r.source_page_url).filter(Boolean));
}

async function attachFeatured(rows: Omit<BlogPost, "body">[]): Promise<PostCard[]> {
  const images = await getImages([...new Set(rows.map((r) => r.featured_image_id).filter((x): x is string => Boolean(x)))]);
  return rows.map((r) => ({ ...r, featured: r.featured_image_id ? (images[r.featured_image_id] ?? null) : null }));
}

// ---------- Public reads: only published articles whose time has come ----------
export async function listPublished(opts: { page?: number; category?: string | null; perPage?: number } = {}): Promise<{ posts: PostCard[]; total: number }> {
  const perPage = opts.perPage ?? POSTS_PER_PAGE;
  const page = Math.max(1, opts.page ?? 1);
  const base = db().from("blog_posts").select(CARD_COLUMNS, { count: "exact" }).eq("status", "published").lte("published_at", nowIso());
  const { data, count } = await (opts.category ? base.eq("category_slug", opts.category) : base)
    .order("published_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  return { posts: await attachFeatured((data ?? []) as Omit<BlogPost, "body">[]), total: count ?? 0 };
}

export async function getPublishedBySlug(slug: string): Promise<BlogPost | null> {
  const { data } = await db().from("blog_posts").select(POST_COLUMNS).eq("status", "published").lte("published_at", nowIso()).eq("slug", slug).maybeSingle();
  return (data as BlogPost | null) ?? null;
}

/** Every published article's light details, for related-article picking and the sitemap. */
export async function listPublishedMeta(): Promise<PostCard[]> {
  const { data } = await db().from("blog_posts").select(CARD_COLUMNS).eq("status", "published").lte("published_at", nowIso()).order("published_at", { ascending: false }).limit(500);
  return attachFeatured((data ?? []) as Omit<BlogPost, "body">[]);
}

export async function getPillar(category: string): Promise<PostCard | null> {
  const { data } = await db().from("blog_posts").select(CARD_COLUMNS).eq("status", "published").lte("published_at", nowIso()).eq("category_slug", category).eq("is_pillar", true).maybeSingle();
  return data ? (await attachFeatured([data as Omit<BlogPost, "body">]))[0] ?? null : null;
}

export async function featuredFor(post: { featured_image_id: string | null }): Promise<PublicImage | null> {
  if (!post.featured_image_id) return null;
  return (await getImages([post.featured_image_id]))[post.featured_image_id] ?? null;
}

// ---------- Admin ----------
export async function listAllPosts(): Promise<PostCard[]> {
  const { data } = await db().from("blog_posts").select(CARD_COLUMNS).order("updated_at", { ascending: false }).limit(500);
  return attachFeatured((data ?? []) as Omit<BlogPost, "body">[]);
}

export async function getPostById(id: string): Promise<BlogPost | null> {
  const { data } = await db().from("blog_posts").select(POST_COLUMNS).eq("id", id).maybeSingle();
  return (data as BlogPost | null) ?? null;
}

export async function slugExists(slug: string, exceptId?: string): Promise<boolean> {
  const base = db().from("blog_posts").select("id").eq("slug", slug);
  const { data } = await (exceptId ? base.neq("id", exceptId) : base).limit(1);
  return (data ?? []).length > 0;
}

export type PostWrite = {
  slug: string; title: string; seo_title: string; meta_description: string; excerpt: string; body: string; category_slug: string | null;
  tags: string[]; is_pillar: boolean; focus_keyword: string; author_name: string; featured_image_id?: string | null;
  status?: "draft" | "published"; published_at?: string | null;
};

export async function createPost(row: PostWrite, userId: string | null): Promise<string> {
  const { data, error } = await db().from("blog_posts").insert({ ...row, updated_by: userId }).select("id").single();
  if (error || !data) throw new DataError(error?.code === "23505" ? "That address (slug) is already used, or the category already has a pillar article." : "Could not create the article.", error?.code);
  return (data as { id: string }).id;
}

export async function updatePost(id: string, row: Partial<PostWrite>, userId: string): Promise<void> {
  const { error } = await db().from("blog_posts").update({ ...row, updated_at: nowIso(), updated_by: userId }).eq("id", id);
  if (error) throw new DataError(error.code === "23505" ? "That address (slug) is already used, or the category already has a pillar article." : "Could not save the article.", error.code);
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await db().from("blog_posts").delete().eq("id", id);
  if (error) throw new DataError("Could not delete the article.", error.code);
}

export async function existingSlugs(): Promise<Set<string>> {
  const { data } = await db().from("blog_posts").select("slug").limit(1000);
  return new Set(((data ?? []) as { slug: string }[]).map((r) => r.slug));
}

export async function removeUnusedImageFiles(paths: string[]): Promise<void> {
  if (paths.length > 0) await db().storage.from("blog").remove(paths);
}
