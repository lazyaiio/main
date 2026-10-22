import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { canWrite } from "@/lib/auth/permissions";
import { requireAppContext } from "@/lib/auth/session";
import { getDb } from "@/lib/data/db";
import { CONTENT_FILTERS, listContent } from "@/lib/data/overview";
import type { ApprovalStatus } from "@/lib/data/types";
import { excerpt, formatDate } from "@/lib/format";
import { languageLabel } from "@/lib/projects";
import { approvalStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Content" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const FILTER_LABELS: Record<string, string> = {
  all: "All",
  draft: "Drafts",
  awaiting_approval: "Needs review",
  approved: "Approved",
  rejected: "Rejected",
};

export default async function ContentPage({ searchParams }: Props) {
  const ctx = await requireAppContext();
  const params = await searchParams;
  const requested = typeof params.status === "string" ? params.status : "all";
  const filter = (CONTENT_FILTERS as readonly string[]).includes(requested)
    ? (requested as "all" | ApprovalStatus)
    : "all";

  const items = await listContent(await getDb(), ctx.workspace.id, filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        description="Every post, with its review status."
        action={
          canWrite(ctx.role) ? (
            <ButtonLink href="/app/content/new">
              <Plus className="h-4 w-4" aria-hidden="true" /> New post
            </ButtonLink>
          ) : null
        }
      />

      {params.notice === "deleted" ? (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Post deleted.
        </p>
      ) : null}

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {CONTENT_FILTERS.map((key) => (
          <Link
            key={key}
            href={key === "all" ? "/app/content" : `/app/content?status=${key}`}
            aria-current={filter === key ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === key
                ? "border-brand bg-brand-50 text-brand-700"
                : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
            )}
          >
            {FILTER_LABELS[key]}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filter === "all" ? "No posts yet" : "Nothing here"}
          body={
            filter === "all"
              ? "Posts you generate will appear here for review. Start with a project."
              : "No posts have this status right now."
          }
          action={
            filter === "all" ? (
              <ButtonLink href={canWrite(ctx.role) ? "/app/content/new" : "/app/projects"} variant="secondary">
                {canWrite(ctx.role) ? "Create a post" : "Go to projects"}
              </ButtonLink>
            ) : (
              <ButtonLink href="/app/content" variant="secondary">
                Show all
              </ButtonLink>
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const meta = approvalStatus[item.approval_status];
            return (
              <li key={item.id}>
                <Link
                  href={`/app/content/${item.id}`}
                  className="block rounded-2xl border border-ink-100 bg-white p-5 shadow-card transition-colors hover:border-brand-200"
                >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-ink-400">
                    {languageLabel(item.language)} · {formatDate(item.created_at, ctx.workspace.timezone)}
                  </p>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
                {item.hook ? <h2 className="mt-2 font-display text-base font-bold">{item.hook}</h2> : null}
                <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{excerpt(item.body, 220)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
