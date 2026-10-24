"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/auth/form-state";
import { firstError } from "@/lib/auth/schemas";
import { requireAppContext } from "@/lib/auth/session";
import { MAX_ALT_LENGTH, MAX_CREDIT_LENGTH } from "@/lib/media/limits";
import { ServiceError } from "@/lib/services/errors";
import * as media from "@/lib/services/media";

const uuid = z.string().uuid();

function errorCode(error: unknown): string {
  return error instanceof ServiceError ? error.kind : "failed";
}

const metaSchema = z.object({
  altText: z.string().trim().max(MAX_ALT_LENGTH, `Alt text: ${MAX_ALT_LENGTH} characters or fewer.`).optional(),
  credit: z.string().trim().max(MAX_CREDIT_LENGTH, `Credit: ${MAX_CREDIT_LENGTH} characters or fewer.`).optional(),
});

/** Reads alt text and credit. In the library grid each image has its own fields, named with a suffix. */
function readMeta(formData: FormData, suffix = "") {
  const get = (key: string) => {
    const v = formData.get(key + suffix);
    return typeof v === "string" && v.trim() ? v : undefined;
  };
  return { altText: get("altText"), credit: get("credit") };
}

/** Optional: after a successful upload, attach the new image to this post. */
function attachTarget(formData: FormData): string | null {
  const parsed = uuid.safeParse(formData.get("attachTo"));
  return parsed.success ? parsed.data : null;
}

/** Upload form (used on the media library and on a post). Returns messages in place. */
export async function uploadImageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = metaSchema.safeParse(readMeta(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };

  const ctx = await requireAppContext();
  const attachTo = attachTarget(formData);
  let assetId: string;
  try {
    assetId = await media.uploadImage(ctx, file, parsed.data);
    if (attachTo) await media.attachImage(ctx, attachTo, assetId);
  } catch (error) {
    return { error: error instanceof ServiceError ? error.message : "Something went wrong. Please try again." };
  }
  revalidatePath("/app/media");
  if (attachTo) {
    revalidatePath(`/app/content/${attachTo}`);
    return redirect(`/app/content/${attachTo}?notice=image_added`);
  }
  return { message: "Image added to your library." };
}

export async function importStockPhotoAction(formData: FormData): Promise<void> {
  const id = z.string().regex(/^\d{1,12}$/).safeParse(formData.get("photoId"));
  const attachTo = attachTarget(formData);
  const base = attachTo ? `/app/media?attachTo=${attachTo}` : "/app/media";
  const sep = base.includes("?") ? "&" : "?";
  if (!id.success) redirect(`${base}${sep}error=not_found`);

  const ctx = await requireAppContext();
  let assetId: string;
  try {
    assetId = await media.importStockPhoto(ctx, id.data);
    if (attachTo) await media.attachImage(ctx, attachTo, assetId);
  } catch (error) {
    redirect(`${base}${sep}error=${errorCode(error)}`);
  }
  revalidatePath("/app/media");
  if (attachTo) {
    revalidatePath(`/app/content/${attachTo}`);
    redirect(`/app/content/${attachTo}?notice=image_added`);
  }
  redirect("/app/media?notice=imported");
}

export async function updateMediaAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("mediaId"));
  if (!id.success) redirect("/app/media");
  const parsed = metaSchema.safeParse(readMeta(formData, `-${id.data}`));
  if (!parsed.success) redirect(`/app/media?error=invalid`);
  const ctx = await requireAppContext();
  try {
    await media.updateMedia(ctx, id.data, { altText: parsed.data.altText ?? null, credit: parsed.data.credit ?? null });
  } catch (error) {
    redirect(`/app/media?error=${errorCode(error)}`);
  }
  revalidatePath("/app/media");
  redirect("/app/media?notice=updated");
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("mediaId"));
  if (!id.success) redirect("/app/media");
  const ctx = await requireAppContext();
  try {
    await media.deleteMedia(ctx, id.data);
  } catch (error) {
    redirect(`/app/media?error=${errorCode(error)}`);
  }
  revalidatePath("/app/media");
  redirect("/app/media?notice=deleted");
}

export async function attachImageAction(formData: FormData): Promise<void> {
  const item = uuid.safeParse(formData.get("itemId"));
  const mediaId = uuid.safeParse(formData.get("mediaId"));
  if (!item.success) redirect("/app/content");
  if (!mediaId.success) redirect(`/app/content/${item.data}?error=not_found`);
  const ctx = await requireAppContext();
  let moved: boolean;
  try {
    moved = (await media.attachImage(ctx, item.data, mediaId.data)).movedToDraft;
  } catch (error) {
    redirect(`/app/content/${item.data}?error=${errorCode(error)}`);
  }
  revalidatePath(`/app/content/${item.data}`);
  redirect(`/app/content/${item.data}?notice=${moved ? "image_added_draft" : "image_added"}`);
}

export async function detachImageAction(formData: FormData): Promise<void> {
  const item = uuid.safeParse(formData.get("itemId"));
  if (!item.success) redirect("/app/content");
  const ctx = await requireAppContext();
  let moved: boolean;
  try {
    moved = (await media.detachImage(ctx, item.data)).movedToDraft;
  } catch (error) {
    redirect(`/app/content/${item.data}?error=${errorCode(error)}`);
  }
  revalidatePath(`/app/content/${item.data}`);
  redirect(`/app/content/${item.data}?notice=${moved ? "image_removed_draft" : "image_removed"}`);
}

