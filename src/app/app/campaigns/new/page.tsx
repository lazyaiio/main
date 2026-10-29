import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { canWrite } from "@/lib/auth/permissions";
import { requireAppContext } from "@/lib/auth/session";
import { addDays, todayInZone } from "@/lib/campaign-plan";
import { getDb } from "@/lib/data/db";
import { listProjects } from "@/lib/data/projects";
import { listSocialPages } from "@/lib/data/social";
import { hasStockProvider } from "@/lib/media/stock-providers";
import { getAiAvailability } from "@/lib/services/generation";

export const metadata: Metadata = { title: "New campaign" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NewCampaignPage({ searchParams }: Props) {
  const ctx = await requireAppContext();
  if (!canWrite(ctx.role)) redirect("/app/campaigns");

  const params = await searchParams;
  const projects = (await listProjects(await getDb(), ctx.workspace.id)).filter((p) => p.status === "active");
  const availability = await getAiAvailability();
  const pages = (await listSocialPages(await getDb(), ctx.workspace.id)).filter((p) => p.status === "connected" && p.capabilities.can_publish === true);
  const stockAvailable = await hasStockProvider();

  const requested = typeof params.project === "string" ? params.project : "";
  const defaultProjectId = projects.find((p) => p.id === requested)?.id ?? projects[0]?.id ?? "";
  const defaultStartDate = addDays(todayInZone(new Date(), ctx.workspace.timezone), 1);

  return (
    <div className="space-y-8">
      <Link href="/app/campaigns" className="text-sm font-medium text-ink-500 hover:text-ink">
        ← Campaigns
      </Link>
      <PageHeader
        title="New campaign"
        description="Choose what to write about and when to post. You see the proposed calendar first. Posts are saved in Content, or scheduled for you if you choose that below."
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Create a project first"
          body="Campaigns belong to a project, which holds your topic, languages, and tone."
          action={<ButtonLink href="/app/projects/new">Create a project</ButtonLink>}
        />
      ) : (
        <div className="max-w-3xl">
          <CampaignForm
            available={availability.available}
            pages={pages.map((p) => ({ id: p.id, name: p.name }))}
            stockAvailable={stockAvailable}
            defaultProjectId={defaultProjectId}
            defaultStartDate={defaultStartDate}
            projects={projects.map((p) => ({
              id: p.id,
              name: p.name,
              languages: p.languages,
              inputType: p.input_type,
              inputValue: p.input_value,
            }))}
          />
        </div>
      )}
    </div>
  );
}
