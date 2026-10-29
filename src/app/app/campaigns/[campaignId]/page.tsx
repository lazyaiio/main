import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  cancelCampaignAction,
  pauseCampaignAction,
  retryFailedAction,
  startCampaignAction,
} from "@/app/app/campaigns/actions";
import { CampaignRunner } from "@/components/campaigns/campaign-runner";
import { PlanTable } from "@/components/campaigns/plan-table";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { canWrite } from "@/lib/auth/permissions";
import { requireAppContext } from "@/lib/auth/session";
import { countCampaignPostsByStatus, getCampaign, listCampaignSlots } from "@/lib/data/campaigns";
import { getDb } from "@/lib/data/db";
import { isBackgroundWriterActive } from "@/lib/data/platform";
import { getProject } from "@/lib/data/projects";
import { formatDate } from "@/lib/format";
import { languageLabel } from "@/lib/projects";
import { messageForCode } from "@/lib/service-messages";
import { runStateOf } from "@/lib/services/campaigns";
import { campaignStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Campaign" };

// The progress panel asks the server to write a few posts per request; allow the longest run time.
export const maxDuration = 60;

type Props = {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const NOTICES: Record<string, string> = {
  created: "Campaign created. Press Start writing when you are ready.",
  started: "Writing started. Your posts will appear in Content as they are written.",
  paused: "Paused. Your progress is saved.",
  canceled: "Campaign canceled. Posts that were already written are kept.",
  retrying: "Failed posts were put back in the queue.",
  nothing_to_retry: "There are no failed posts to retry.",
};

function ControlForm({
  action,
  campaignId,
  label,
  pendingLabel,
  variant = "secondary",
}: {
  action: (formData: FormData) => Promise<void>;
  campaignId: string;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <form action={action}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <PendingButton variant={variant} pendingLabel={pendingLabel}>
        {label}
      </PendingButton>
    </form>
  );
}

export default async function CampaignPage({ params, searchParams }: Props) {
  const { campaignId } = await params;
  if (!z.string().uuid().safeParse(campaignId).success) return notFound();

  const ctx = await requireAppContext();
  const db = await getDb();
  const campaign = await getCampaign(db, ctx.workspace.id, campaignId);
  if (!campaign) return notFound();

  const [slots, project, postCounts] = await Promise.all([
    listCampaignSlots(db, ctx.workspace.id, campaignId),
    getProject(db, ctx.workspace.id, campaign.project_id),
    countCampaignPostsByStatus(db, ctx.workspace.id, campaignId),
  ]);

  const sp = await searchParams;
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const error = messageForCode(sp.error);

  const writable = canWrite(ctx.role);
  const state = runStateOf(campaign);
  const meta = campaignStatus[campaign.status];
  const status = campaign.status;
  const hasFailed = slots.some((slot) => slot.status === "failed");
  const canStart = status === "draft" || status === "paused";
  const canCancel = ["draft", "generating", "paused", "ready", "failed"].includes(status);
  const canRetry = hasFailed && ["ready", "failed", "paused"].includes(status);

  return (
    <div className="space-y-6">
      <Link href="/app/campaigns" className="text-sm font-medium text-ink-500 hover:text-ink">
        ← Campaigns
      </Link>

      <PageHeader
        title={campaign.name}
        description={[
          `${campaign.requested_item_count} posts over ${campaign.duration_days} days`,
          campaign.languages.map(languageLabel).join(", "),
          project ? project.name : null,
          `Created ${formatDate(campaign.created_at, ctx.workspace.timezone)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={<Badge tone={meta.tone}>{meta.label}</Badge>}
      />

      {notice ? (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <CampaignRunner
        campaignId={campaign.id}
        canRun={writable}
        backgroundActive={await isBackgroundWriterActive()}
        initial={{
          status: state.status,
          total: state.total,
          completed: state.completed,
          failed: state.failed,
          remaining: state.remaining,
          keepGoing: state.keepGoing,
          message: null,
        }}
      />

      {writable ? (
        <div className="flex flex-wrap items-center gap-3">
          {canStart ? (
            <ControlForm
              action={startCampaignAction}
              campaignId={campaign.id}
              label={status === "paused" ? "Resume writing" : "Start writing"}
              pendingLabel="Starting…"
              variant="primary"
            />
          ) : null}
          {status === "generating" ? (
            <ControlForm action={pauseCampaignAction} campaignId={campaign.id} label="Pause" pendingLabel="Pausing…" />
          ) : null}
          {canRetry ? (
            <ControlForm action={retryFailedAction} campaignId={campaign.id} label="Retry failed posts" pendingLabel="Retrying…" />
          ) : null}
          {canCancel ? (
            <ControlForm action={cancelCampaignAction} campaignId={campaign.id} label="Cancel campaign" pendingLabel="Canceling…" variant="ghost" />
          ) : null}
          {Object.values(postCounts).reduce((sum, n) => sum + n, 0) > 0 ? (
            <ButtonLink href="/app/content" variant="secondary">
              View posts
            </ButtonLink>
          ) : null}
        </div>
      ) : null}

      {campaign.brief.topic || campaign.brief.source_url ? (
        <p className="text-sm text-ink-600">
          {campaign.brief.topic ? (
            <>
              <span className="font-medium text-ink-700">Topic:</span> {campaign.brief.topic}
            </>
          ) : null}
          {campaign.brief.source_url ? (
            <>
              {campaign.brief.topic ? " · " : null}
              <span className="font-medium text-ink-700">Based on:</span> {campaign.brief.source_url}
            </>
          ) : null}
        </p>
      ) : null}

      {slots.length > 0 ? <PlanTable slots={slots} timeZone={ctx.workspace.timezone} /> : null}

      <p className="text-xs text-ink-500">
        {campaign.brief.auto_schedule === "1"
          ? "Each post is scheduled automatically for its planned time on the Page you chose. AI can make mistakes, so open the posts you care about and read them. You can edit, reschedule, or cancel any post before it goes out."
          : "Written posts are saved in Content, ready for you to schedule. Nothing is published unless you schedule it."}
      </p>
    </div>
  );
}
