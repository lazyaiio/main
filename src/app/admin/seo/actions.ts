"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { readSeoSettings, savePageOverride, writeSeoSettings } from "@/lib/data/seo";
import { cleanPageOverride, cleanSiteFields, cleanTracking, cleanVerification, isSeoPath } from "@/lib/seo";
import { forgetSeoCache } from "@/lib/services/seo";

const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
};

function back(kind: "notice" | "error", message: string): never {
  redirect(`/admin/seo?${kind}=${encodeURIComponent(message)}`);
}

function refresh() {
  forgetSeoCache();
  revalidatePath("/", "layout");
  revalidatePath("/admin/seo");
}

/** Site-wide search settings: indexing switch, titles, description, share card, organization, robots. */
export async function saveSiteSeoAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const cleaned = cleanSiteFields({
    allowIndexing: formData.get("allowIndexing") === "on",
    titleTemplate: field(formData, "titleTemplate"),
    defaultTitle: field(formData, "defaultTitle"),
    defaultDescription: field(formData, "defaultDescription"),
    ogImageUrl: field(formData, "ogImageUrl"),
    twitterHandle: field(formData, "twitterHandle"),
    orgName: field(formData, "orgName"),
    orgLogoUrl: field(formData, "orgLogoUrl"),
    sameAs: field(formData, "sameAs"),
    blockAiCrawlers: formData.get("blockAiCrawlers") === "on",
    robotsExtra: field(formData, "robotsExtra"),
  });
  if (!cleaned.ok) back("error", cleaned.error);
  try {
    await writeSeoSettings({ ...(await readSeoSettings()), ...cleaned.value }, ctx.user.id);
  } catch {
    back("error", "Could not save. Check that migration 0011 was run.");
  }
  refresh();
  back("notice", "Site settings saved.");
}

export async function saveVerificationAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const cleaned = cleanVerification(
    { google: field(formData, "google"), bing: field(formData, "bing"), yandex: field(formData, "yandex"), pinterest: field(formData, "pinterest"), baidu: field(formData, "baidu"), facebook: field(formData, "facebook") },
    field(formData, "customMeta"),
  );
  if (!cleaned.ok) back("error", cleaned.error);
  try {
    await writeSeoSettings({ ...(await readSeoSettings()), ...cleaned.value }, ctx.user.id);
  } catch {
    back("error", "Could not save.");
  }
  refresh();
  back("notice", "Verification tags saved. They appear on every page.");
}

export async function saveTrackingAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const cleaned = cleanTracking({ ga4: field(formData, "ga4"), gtm: field(formData, "gtm"), metaPixel: field(formData, "metaPixel"), clarity: field(formData, "clarity") });
  if (!cleaned.ok) back("error", cleaned.error);
  try {
    await writeSeoSettings({ ...(await readSeoSettings()), tracking: cleaned.value }, ctx.user.id);
  } catch {
    back("error", "Could not save.");
  }
  refresh();
  back("notice", "Tracking IDs saved. They load only after a visitor accepts the cookie banner.");
}

export async function savePageSeoAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const path = field(formData, "path");
  if (!isSeoPath(path)) back("error", "Unknown page.");
  const cleaned = cleanPageOverride({ title: field(formData, "title"), description: field(formData, "description"), ogImage: field(formData, "ogImage"), noindex: formData.get("noindex") === "on" });
  if (!cleaned.ok) back("error", cleaned.error);
  try {
    await savePageOverride(path, cleaned.value, ctx.user.id);
  } catch {
    back("error", "Could not save. Check that migration 0021 was run.");
  }
  refresh();
  back("notice", `Saved ${path}.`);
}
