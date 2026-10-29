"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/auth/form-state";
import { firstError } from "@/lib/auth/schemas";
import { requireAppContext } from "@/lib/auth/session";
import { campaignFormSchema, readCampaignForm } from "@/lib/campaign-plan";
import * as campaigns from "@/lib/services/campaigns";
import type { CampaignRunState } from "@/lib/services/campaigns";
import { ServiceError } from "@/lib/services/errors";

const uuid = z.string().uuid();

/** What the new-campaign form shows after "Preview calendar". Plain data only. */
export type PlanPreviewRow = {
  index: number;
  localDate: string;
  localTime: string;
  language: "en" | "bn";
  format: string;
  theme: string | null;
};

export type PlanFormState = FormState & { preview?: PlanPreviewRow[] };

function messageFor(error: unknown): string {
  return error instanceof ServiceError ? error.message : "Something went wrong. Please try again.";
}

function errorCode(error: unknown): string {
  return error instanceof ServiceError ? error.kind : "failed";
}

/** Echo of what the user typed, so the form keeps its values after a preview or an error. */
function echo(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string" || key.startsWith("$ACTION")) continue;
    // Repeated fields (checkboxes) are joined with a comma so the form can restore them.
    values[key] = key in values ? `${values[key]},${value}` : value;
  }
  // Angles are one per line; keep the line breaks.
  const themes = formData.get("themes");
  if (typeof themes === "string") values.themes = themes;
  return values;
}

/**
 * Step 1: "Preview calendar" shows the proposed plan without saving anything.
 * Step 2: "Create campaign" saves the same plan (it is rebuilt on the server from the same inputs).
 */
export async function planCampaignAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const values = echo(formData);
  const intent = formData.get("intent") === "create" ? "create" : "preview";

  const parsed = campaignFormSchema.safeParse(readCampaignForm(formData));
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const ctx = await requireAppContext();

  if (intent === "preview") {
    try {
      const slots = await campaigns.previewCampaign(ctx, parsed.data);
      return {
        values,
        message: `Here is the proposed calendar: ${slots.length} ${slots.length === 1 ? "post" : "posts"}. Change anything above and preview again, or create the campaign.`,
        preview: slots.map((s) => ({
          index: s.index,
          localDate: s.localDate,
          localTime: s.localTime,
          language: s.language,
          format: s.format,
          theme: s.theme,
        })),
      };
    } catch (error) {
      return { error: messageFor(error), values };
    }
  }

  let id: string;
  try {
    id = await campaigns.createCampaign(ctx, parsed.data);
  } catch (error) {
    return { error: messageFor(error), values };
  }
  revalidatePath("/app/campaigns");
  return redirect(`/app/campaigns/${id}?notice=created`);
}

async function control(
  formData: FormData,
  run: (ctx: Awaited<ReturnType<typeof requireAppContext>>, id: string) => Promise<string>,
): Promise<void> {
  const id = uuid.safeParse(formData.get("campaignId"));
  if (!id.success) redirect("/app/campaigns");
  const ctx = await requireAppContext();
  let notice: string;
  try {
    notice = await run(ctx, id.data);
  } catch (error) {
    redirect(`/app/campaigns/${id.data}?error=${errorCode(error)}`);
  }
  revalidatePath("/app/campaigns");
  revalidatePath(`/app/campaigns/${id.data}`);
  redirect(`/app/campaigns/${id.data}?notice=${notice}`);
}

export async function startCampaignAction(formData: FormData): Promise<void> {
  return control(formData, async (ctx, id) => {
    await campaigns.startCampaign(ctx, id);
    return "started";
  });
}

export async function pauseCampaignAction(formData: FormData): Promise<void> {
  return control(formData, async (ctx, id) => {
    await campaigns.pauseCampaign(ctx, id);
    return "paused";
  });
}

export async function cancelCampaignAction(formData: FormData): Promise<void> {
  return control(formData, async (ctx, id) => {
    await campaigns.cancelCampaign(ctx, id);
    return "canceled";
  });
}

export async function retryFailedAction(formData: FormData): Promise<void> {
  return control(formData, async (ctx, id) => {
    const count = await campaigns.retryFailedPosts(ctx, id);
    return count > 0 ? "retrying" : "nothing_to_retry";
  });
}

export type RunResult = { ok: true; state: CampaignRunState } | { ok: false; error: string };

/**
 * One round of generation, called again and again by the progress panel while it is open.
 * Returns data (not a redirect) so the page can update in place. Hosted pages that call this
 * export `maxDuration = 60`.
 */
export async function runCampaignBatchAction(campaignId: string): Promise<RunResult> {
  const id = uuid.safeParse(campaignId);
  if (!id.success) return { ok: false, error: "That campaign could not be found." };
  const ctx = await requireAppContext();
  try {
    return { ok: true, state: await campaigns.runCampaignBatch(ctx, id.data) };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}
