import { createHash } from "node:crypto";
import { z } from "zod";
import { cleanHashtags } from "@/lib/ai/post-schema";
import type { ApprovalStatus } from "@/lib/data/types";

/** Stable fingerprint of a post's wording, ignoring case, punctuation, and spacing. */
export function hashContent(body: string): string {
  const normalized = body
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return createHash("sha256").update(normalized).digest("hex");
}

/** "#tips, #small business  marketing" -> ["tips", "small", "business", "marketing"] */
export function parseHashtags(input: string): string[] {
  return cleanHashtags(input.split(/[\s,]+/).filter(Boolean));
}

export function formatHashtagsForInput(tags: string[]): string {
  return tags.map((t) => `#${t}`).join(" ");
}

export const contentFormSchema = z.object({
  hook: z.string().trim().max(300, "Hook: 300 characters or fewer.").optional(),
  body: z.string().trim().min(1, "The post text cannot be empty.").max(10000, "The post text is too long."),
  cta: z.string().trim().max(300, "Call to action: 300 characters or fewer.").optional(),
  hashtags: z.string().max(500, "Too many hashtags.").optional(),
  imageBrief: z.string().trim().max(1000, "Image idea: 1,000 characters or fewer.").optional(),
});

export type ContentFormInput = z.infer<typeof contentFormSchema>;

export const manualPostSchema = z.object({
  projectId: z.union([z.string().uuid(), z.literal("")]).optional(),
  language: z.enum(["en", "bn"], { message: "Choose a language." }),
  body: contentFormSchema.shape.body,
});

const TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  draft: ["awaiting_approval", "cancelled"],
  awaiting_approval: ["approved", "rejected", "draft"],
  approved: ["draft", "cancelled"],
  rejected: ["draft"],
  cancelled: ["draft"],
};

export function allowedTransitions(from: ApprovalStatus): ApprovalStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Posts that were already approved or scheduled must not be deleted silently. */
export function isDeletable(status: ApprovalStatus): boolean {
  return status === "draft" || status === "rejected" || status === "cancelled";
}

export const TRANSITION_LABELS: Record<ApprovalStatus, string> = {
  draft: "Move back to draft",
  awaiting_approval: "Submit for review",
  approved: "Approve",
  rejected: "Reject",
  cancelled: "Cancel post",
};
