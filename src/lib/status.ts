import type { BadgeTone } from "@/components/ui/badge";
import type { ApprovalStatus, CampaignStatus, PostStatus, SlotStatus } from "@/lib/data/types";

type Meta = { label: string; tone: BadgeTone };

export const approvalStatus: Record<ApprovalStatus, Meta> = {
  draft: { label: "Draft", tone: "neutral" },
  awaiting_approval: { label: "Needs review", tone: "amber" },
  approved: { label: "Approved", tone: "brand" },
  rejected: { label: "Rejected", tone: "neutral" },
  cancelled: { label: "Canceled", tone: "neutral" },
};

export const campaignStatus: Record<CampaignStatus, Meta> = {
  draft: { label: "Draft", tone: "neutral" },
  planning: { label: "Planning", tone: "brand" },
  generating: { label: "Generating", tone: "brand" },
  ready: { label: "Ready to review", tone: "amber" },
  paused: { label: "Paused", tone: "neutral" },
  completed: { label: "Completed", tone: "green" },
  failed: { label: "Failed", tone: "amber" },
  cancelled: { label: "Canceled", tone: "neutral" },
};

export const postStatus: Record<PostStatus, Meta> = {
  scheduled: { label: "Scheduled", tone: "brand" },
  publishing: { label: "Publishing", tone: "brand" },
  retrying: { label: "Retrying", tone: "amber" },
  published: { label: "Published", tone: "green" },
  failed: { label: "Failed", tone: "amber" },
  cancelled: { label: "Canceled", tone: "neutral" },
};

export const slotStatus: Record<SlotStatus, Meta> = {
  planned: { label: "Planned", tone: "neutral" },
  generating: { label: "Writing", tone: "brand" },
  done: { label: "Written", tone: "green" },
  failed: { label: "Failed", tone: "amber" },
  skipped: { label: "Skipped", tone: "neutral" },
};
