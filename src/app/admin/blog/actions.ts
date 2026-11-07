"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { BLOG_CATEGORIES, cleanTags, makeSlug, replaceImageId, validatePost, type PostInput } from "@/lib/blog";
import { createPost, deletePost, getPostById, slugExists, updatePost } from "@/lib/data/blog";
import { loadStockProviders } from "@/lib/media/stock-providers";
import { importStockPhotoForBlog } from "@/lib/services/blog-images";
import { findPhotosForPost, importSeedArticles, publishProblem } from "@/lib/services/blog";

const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
};
const uuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);

function go(path: string, kind: "notice" | "error", message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`);
}

function refreshBlog(slug?: string) {
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath("/blog", "layout");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/blog/${slug}`);
}

export async function importSeedAction(): Promise<void> {
  const ctx = await requirePlatformAdmin();
  let result: { created: number; skipped: number };
  try {
    result = await importSeedArticles(ctx.user.id);
  } catch {
    go("/admin/blog", "error", "Could not add the starter articles. Check that migration 0022 was run.");
  }
  refreshBlog();
  go("/admin/blog", "notice", result.created > 0 ? `Added ${result.created} starter article${result.created === 1 ? "" : "s"} as drafts. Open each one, find its photos, read it, and publish.` : "All starter articles are already in the blog.");
}

export async function newPostAction(): Promise<void> {
  const ctx = await requirePlatformAdmin();
  let id: string;
  try {
    id = await createPost(
      { slug: `new-article-${Date.now().toString(36)}`, title: "New article", seo_title: "", meta_description: "", excerpt: "", body: "## Write your first section here\n\nStart with a short paragraph that tells the reader what they will learn.", category_slug: null, tags: [], is_pillar: false, focus_keyword: "", author_name: "LazyAI Team" },
      ctx.user.id,
    );
  } catch {
    go("/admin/blog", "error", "Could not create the article.");
  }
  redirect(`/admin/blog/${id}`);
}

/** Save, publish, schedule, or take an article offline, depending on the button pressed. */
export async function savePostAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const id = field(formData, "id");
  if (!uuid(id)) go("/admin/blog", "error", "Unknown article.");
  const here = `/admin/blog/${id}`;
  const current = await getPostById(id);
  if (!current) go("/admin/blog", "error", "Unknown article.");

  const title = field(formData, "title").trim();
  const input: PostInput = {
    title,
    slug: field(formData, "slug").trim() || makeSlug(title),
    seoTitle: field(formData, "seoTitle").trim(),
    metaDescription: field(formData, "metaDescription").trim(),
    excerpt: field(formData, "excerpt").trim(),
    body: field(formData, "body").replace(/\r\n?/g, "\n"),
    categorySlug: field(formData, "category"),
    focusKeyword: field(formData, "focusKeyword").trim(),
    authorName: field(formData, "authorName").trim() || "LazyAI Team",
  };
  const problem = validatePost(input);
  if (problem) go(here, "error", problem);
  if (input.categorySlug && !BLOG_CATEGORIES.some((c) => c.slug === input.categorySlug)) go(here, "error", "Unknown category.");
  if (await slugExists(input.slug, id)) go(here, "error", "Another article already uses that address (slug).");

  const intent = field(formData, "intent") || "save";
  if (!["save", "publish", "schedule", "unpublish"].includes(intent)) go(here, "error", "Could not tell which button was pressed. Nothing was changed. Please try again.");
  const row = {
    slug: input.slug, title: input.title, seo_title: input.seoTitle, meta_description: input.metaDescription, excerpt: input.excerpt, body: input.body,
    category_slug: input.categorySlug || null, tags: cleanTags(field(formData, "tags")), is_pillar: formData.get("isPillar") === "on", focus_keyword: input.focusKeyword, author_name: input.authorName,
  };

  let status: "draft" | "published" = current.status;
  let publishedAt = current.published_at;
  let message = "Saved.";
  if (intent === "publish" || intent === "schedule") {
    const stop = publishProblem({ ...row, category_slug: row.category_slug, featured_image_id: current.featured_image_id });
    if (stop) go(here, "error", stop);
    status = "published";
    if (intent === "schedule") {
      const when = new Date(`${field(formData, "publishAt")}:00Z`);
      if (!field(formData, "publishAt") || Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 60_000) go(here, "error", "Choose a publish time in the future (UTC).");
      publishedAt = when.toISOString();
      message = `Scheduled for ${when.toISOString().slice(0, 16).replace("T", " ")} UTC.`;
    } else {
      // Keep the original date when an article that was live is saved again.
      publishedAt = current.status === "published" && current.published_at && new Date(current.published_at).getTime() <= Date.now() ? current.published_at : new Date().toISOString();
      message = "Published.";
    }
  } else if (intent === "unpublish") {
    status = "draft";
    publishedAt = null;
    message = "The article is now a draft and is not public.";
  }

  try {
    await updatePost(id, { ...row, status, published_at: publishedAt }, ctx.user.id);
  } catch (e) {
    go(here, "error", e instanceof Error ? e.message : "Could not save.");
  }
  refreshBlog(input.slug);
  if (current.slug !== input.slug) revalidatePath(`/blog/${current.slug}`);
  go(here, "notice", message);
}

export async function deletePostAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = field(formData, "id");
  if (!uuid(id)) go("/admin/blog", "error", "Unknown article.");
  const post = await getPostById(id);
  try {
    await deletePost(id);
  } catch {
    go("/admin/blog", "error", "Could not delete the article.");
  }
  refreshBlog(post?.slug);
  go("/admin/blog", "notice", "Article deleted.");
}

export async function findPhotosAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const id = field(formData, "id");
  if (!uuid(id)) go("/admin/blog", "error", "Unknown article.");
  let message: string;
  try {
    message = (await findPhotosForPost(id, ctx.user.id)).message;
  } catch {
    go(`/admin/blog/${id}`, "error", "Finding photos failed. Please try again.");
  }
  refreshBlog();
  go(`/admin/blog/${id}`, "notice", message);
}

/** Uses a photo chosen in the search results: as the featured image, added to the end of the text, or in place of another picture. */
export async function choosePhotoAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const id = field(formData, "id");
  if (!uuid(id)) go("/admin/blog", "error", "Unknown article.");
  const here = `/admin/blog/${id}`;
  const [providerKey, photoId] = field(formData, "photoRef").split(":");
  const mode = field(formData, "mode");
  const target = field(formData, "target");
  const post = await getPostById(id);
  if (!post || !providerKey || !photoId) go(here, "error", "Unknown photo.");

  let imageId: string;
  let alt = "";
  try {
    const provider = (await loadStockProviders()).find((p) => p.id === providerKey);
    const photo = provider ? await provider.getById(photoId) : null;
    if (!photo) go(here, "error", "That photo could not be found.");
    alt = field(formData, "alt").trim().slice(0, 300) || photo.alt || post.title;
    imageId = await importStockPhotoForBlog({ ...photo, alt });
  } catch (e) {
    go(here, "error", e instanceof Error && e.message ? e.message : "Could not add the photo.");
  }

  try {
    if (mode === "featured") await updatePost(id, { featured_image_id: imageId }, ctx.user.id);
    else if (mode === "replace" && uuid(target)) await updatePost(id, { body: replaceImageId(post.body, target, imageId, alt), ...(post.featured_image_id === target ? { featured_image_id: imageId } : {}) }, ctx.user.id);
    else await updatePost(id, { body: `${post.body.trimEnd()}\n\n![${alt.replace(/[\[\]\n]/g, " ")}](blog-image:${imageId})\n` }, ctx.user.id);
  } catch {
    go(here, "error", "Could not save the article.");
  }
  refreshBlog(post.slug);
  go(here, "notice", mode === "featured" ? "Featured image changed." : mode === "replace" ? "Picture replaced." : "Picture added at the end of the article. Move it to where it belongs.");
}
