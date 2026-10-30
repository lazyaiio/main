"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { getPageVersion, resetSitePage, saveSitePage } from "@/lib/data/site-pages";
import { normalizeHome, parseLines, parsePairLines, validateHome, type HomeContent } from "@/lib/home-content";
import { EDITABLE_PAGES, isPageSlug, validatePageInput } from "@/lib/site-pages";

const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
};

function refresh(slug: string) {
  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${slug}`);
  const page = EDITABLE_PAGES.find((p) => p.slug === slug);
  revalidatePath(page ? page.path : "/");
}

/** Saves the text of one page. Keeps the previous versions so a mistake can be undone. */
export async function savePageAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const slug = field(formData, "slug");
  if (!isPageSlug(slug)) redirect("/admin/pages?error=invalid");
  const input = { title: field(formData, "title"), intro: field(formData, "intro"), body: field(formData, "body") };
  const problem = validatePageInput(input);
  if (problem) redirect(`/admin/pages/${slug}?error=${encodeURIComponent(problem)}`);
  try {
    await saveSitePage(slug, input, ctx.user.id);
  } catch {
    redirect(`/admin/pages/${slug}?error=${encodeURIComponent("Could not save. Check that migration 0018 was run.")}`);
  }
  refresh(slug);
  redirect(`/admin/pages/${slug}?notice=saved`);
}

/** Goes back to the built-in text (older versions stay in the list). */
export async function resetPageAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const slug = field(formData, "slug");
  if (!isPageSlug(slug) && slug !== "home") redirect("/admin/pages?error=invalid");
  try {
    await resetSitePage(slug);
  } catch {
    redirect(`/admin/pages/${slug}?error=${encodeURIComponent("Could not reset the page.")}`);
  }
  refresh(slug);
  revalidatePath("/");
  redirect(`/admin/pages/${slug}?notice=reset`);
}

export async function restoreVersionAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const slug = field(formData, "slug");
  const id = Number(field(formData, "versionId"));
  if ((!isPageSlug(slug) && slug !== "home") || !Number.isInteger(id)) redirect("/admin/pages?error=invalid");
  const version = await getPageVersion(slug, id);
  if (!version) redirect(`/admin/pages/${slug}?error=${encodeURIComponent("That version was not found.")}`);
  try {
    await saveSitePage(slug, { title: version.title, intro: version.intro, body: version.body, data: version.data }, ctx.user.id);
  } catch {
    redirect(`/admin/pages/${slug}?error=${encodeURIComponent("Could not restore that version.")}`);
  }
  refresh(slug);
  revalidatePath("/");
  redirect(`/admin/pages/${slug}?notice=restored`);
}

/** Saves the words of the home page. */
export async function saveHomeAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const raw: HomeContent = {
    hero: {
      badge: field(formData, "hero_badge"),
      titleLead: field(formData, "hero_titleLead"),
      titleAccent: field(formData, "hero_titleAccent"),
      subtitle: field(formData, "hero_subtitle"),
      primaryCta: field(formData, "hero_primaryCta"),
      secondaryCta: field(formData, "hero_secondaryCta"),
      reassurances: parseLines(field(formData, "hero_reassurances")),
    },
    how: { title: field(formData, "how_title"), steps: parsePairLines(field(formData, "how_steps")) },
    features: { title: field(formData, "features_title"), items: parsePairLines(field(formData, "features_items")) },
    faq: {
      title: field(formData, "faq_title"),
      items: parsePairLines(field(formData, "faq_items")).map((p) => ({ q: p.title, a: p.body })),
    },
    cta: { title: field(formData, "cta_title"), subtitle: field(formData, "cta_subtitle"), button: field(formData, "cta_button") },
  };
  const content = normalizeHome(raw);
  const problem = validateHome(content);
  if (problem) redirect(`/admin/pages/home?error=${encodeURIComponent(problem)}`);
  try {
    await saveSitePage("home", { title: "Home", intro: "", body: "", data: content as unknown as Record<string, unknown> }, ctx.user.id);
  } catch {
    redirect(`/admin/pages/home?error=${encodeURIComponent("Could not save. Check that migration 0018 was run.")}`);
  }
  revalidatePath("/");
  revalidatePath("/admin/pages/home");
  redirect("/admin/pages/home?notice=saved");
}
