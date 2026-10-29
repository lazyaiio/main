import "server-only";
import { adminDb } from "@/lib/data/platform";
import type { CampaignBrief } from "@/lib/data/types";
import { logError } from "@/lib/log";
import { attachAutoImage } from "./auto-image";

/**
 * Extra steps for a campaign post that was just written: add a stock photo, and schedule it, when the
 * campaign asked for that. Used by both the browser-driven writer and the background writer. Runs with
 * the service role, so the campaign's own settings (saved by a signed-in person) decide what happens.
 * It never throws: the post already exists and is good without these extras.
 */
export async function finishCampaignPost(args: {
  workspaceId: string;
  userId: string | null;
  brief: CampaignBrief;
  itemId: string;
  plannedAt: string | null;
  imageBrief: string | null;
}): Promise<{ image: string; scheduled: boolean }> {
  let image = "off";
  let scheduled = false;

  if (args.brief.auto_image === "1") {
    image = await attachAutoImage({
      workspaceId: args.workspaceId,
      userId: args.userId,
      itemId: args.itemId,
      imageBrief: args.imageBrief,
      topic: args.brief.topic ?? null,
    });
  }

  if (args.brief.auto_schedule === "1" && args.brief.page_id && args.plannedAt) {
    try {
      const { error } = await adminDb().rpc("system_schedule_post", {
        p_workspace_id: args.workspaceId,
        p_content_item_id: args.itemId,
        p_social_page_id: args.brief.page_id,
        p_scheduled_at: args.plannedAt,
      });
      // A planned time that already passed, or a Page that was disconnected, leaves the post ready but unscheduled.
      if (error) logError("campaign.auto_schedule_skipped", { code: error.code ?? "unknown" });
      else scheduled = true;
    } catch {
      logError("campaign.auto_schedule_failed", {});
    }
  }
  return { image, scheduled };
}
