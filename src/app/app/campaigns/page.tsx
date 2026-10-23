import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { canWrite } from "@/lib/auth/permissions";
import { requireAppContext } from "@/lib/auth/session";
import { getDb } from "@/lib/data/db";
import { listCampaigns } from "@/lib/data/overview";
import { formatDate } from "@/lib/format";
import { languageLabel } from "@/lib/projects";
import { campaignStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const ctx = await requireAppContext();
  const campaigns = await listCampaigns(await getDb(), ctx.workspace.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="A campaign is a planned set of posts over up to 90 days. You preview the calendar, then the AI writes the drafts in small batches."
        action={canWrite(ctx.role) ? <ButtonLink href="/app/campaigns/new">New campaign</ButtonLink> : undefined}
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          body="Plan 7 to 90 days of posts at once. Pick a project, a topic, and your posting days, and preview the calendar before anything is written."
          action={
            canWrite(ctx.role) ? (
              <ButtonLink href="/app/campaigns/new">Plan a campaign</ButtonLink>
            ) : (
              <ButtonLink href="/app/projects" variant="secondary">
                Go to projects
              </ButtonLink>
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {campaigns.map((campaign) => {
            const meta = campaignStatus[campaign.status];
            const total = campaign.generation_progress.total ?? campaign.requested_item_count;
            const done = campaign.generation_progress.completed ?? 0;
            const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
            return (
              <li key={campaign.id} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-bold">
                    <Link href={`/app/campaigns/${campaign.id}`} className="hover:text-brand hover:underline">
                      {campaign.name}
                    </Link>
                  </h2>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-500">
                  {campaign.requested_item_count} posts over {campaign.duration_days} days ·{" "}
                  {campaign.languages.map(languageLabel).join(", ")} · Created{" "}
                  {formatDate(campaign.created_at, ctx.workspace.timezone)}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100"
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${campaign.name} generation progress`}
                  >
                    <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="text-xs font-medium text-ink-500">
                    {done}/{total}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
