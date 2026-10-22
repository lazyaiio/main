"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { postRequestSchema } from "@/lib/ai/post-schema";
import type { FormState } from "@/lib/auth/form-state";
import { firstError } from "@/lib/auth/schemas";
import { requireAppContext } from "@/lib/auth/session";
import { contentFormSchema, manualPostSchema } from "@/lib/content";
import * as content from "@/lib/services/content";
import { ServiceError } from "@/lib/services/errors";
import { generatePost, regeneratePost } from "@/lib/services/generation";

const uuid = z.string().uuid();
const STATUSES = ["draft", "awaiting_approval", "approved", "rejected", "cancelled"] as const;

const str = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
};
const optional = (formData: FormData, key: string) => str(formData, key) || undefined;

function messageFor(error: unknown): string {
  return error instanceof ServiceError ? error.message : "Something went wrong. Please try again.";
}
function errorCode(error: unknown): string {
  return error instanceof ServiceError ? error.kind : "failed";
}

export async function generatePostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values: Record<string, string> = {
    projectId: str(formData, "projectId"),
    language: str(formData, "language"),
    format: str(formData, "format"),
    topic: str(formData, "topic"),
    sourceUrl: str(formData, "sourceUrl"),
    length: str(formData, "length"),
    tone: str(formData, "tone"),
    audience: str(formData, "audience"),
    cta: str(formData, "cta"),
    notes: str(formData, "notes"),
  };
  const parsed = postRequestSchema.safeParse({
    ...values,
    topic: optional(formData, "topic"),
    sourceUrl: optional(formData, "sourceUrl"),
    tone: optional(formData, "tone"),
    audience: optional(formData, "audience"),
    cta: optional(formData, "cta"),
    notes: optional(formData, "notes"),
  });
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const ctx = await requireAppContext();
  let id: string;
  try {
    id = await generatePost(ctx, parsed.data);
  } catch (error) {
    return { error: messageFor(error), values };
  }
  revalidatePath("/app/content");
  return redirect(`/app/content/${id}?notice=generated`);
}

export async function createManualPostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { projectId: str(formData, "projectId"), language: str(formData, "language"), body: str(formData, "body") };
  const parsed = manualPostSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const ctx = await requireAppContext();
  let id: string;
  try {
    id = await content.createManualPost(ctx, {
      projectId: parsed.data.projectId || null,
      language: parsed.data.language,
      body: parsed.data.body,
    });
  } catch (error) {
    return { error: messageFor(error), values };
  }
  revalidatePath("/app/content");
  return redirect(`/app/content/${id}?notice=created`);
}

export async function updateContentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    hook: str(formData, "hook"),
    body: str(formData, "body"),
    cta: str(formData, "cta"),
    hashtags: str(formData, "hashtags"),
    imageBrief: str(formData, "imageBrief"),
  };
  const id = uuid.safeParse(formData.get("itemId"));
  if (!id.success) return { error: "That post could not be found.", values };
  const parsed = contentFormSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const ctx = await requireAppContext();
  try {
    const { movedToDraft } = await content.updateContent(ctx, id.data, parsed.data);
    revalidatePath("/app/content");
    return {
      success: true,
      message: movedToDraft
        ? "Saved. Because the post was approved, it moved back to Draft. Approve it again when you are ready."
        : "Saved.",
      values,
    };
  } catch (error) {
    return { error: messageFor(error), values };
  }
}

export async function regenerateAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("itemId"));
  if (!id.success) redirect("/app/content");
  const ctx = await requireAppContext();
  try {
    await regeneratePost(ctx, id.data);
  } catch (error) {
    redirect(`/app/content/${id.data}?error=${errorCode(error)}`);
  }
  revalidatePath("/app/content");
  redirect(`/app/content/${id.data}?notice=regenerated`);
}

export async function setStatusAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("itemId"));
  const to = z.enum(STATUSES).safeParse(formData.get("to"));
  if (!id.success || !to.success) redirect("/app/content");
  const ctx = await requireAppContext();
  try {
    await content.setContentStatus(ctx, id.data, to.data);
  } catch (error) {
    redirect(`/app/content/${id.data}?error=${errorCode(error)}`);
  }
  revalidatePath("/app/content");
  redirect(`/app/content/${id.data}?notice=status`);
}

export async function deleteContentAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("itemId"));
  if (!id.success) redirect("/app/content");
  const ctx = await requireAppContext();
  try {
    await content.deleteContent(ctx, id.data);
  } catch (error) {
    redirect(`/app/content/${id.data}?error=${errorCode(error)}`);
  }
  revalidatePath("/app/content");
  redirect("/app/content?notice=deleted");
}
