import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { z } from "zod";
import { ContentEditor } from "@/components/content/content-editor";
import { PostImageCard } from "@/components/media/post-image-card";
import { ScheduleCard } from "@/components/schedule/schedule-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { canWrite } from "@/lib/auth/permissions";
import { requireAppContext } from "@/lib/auth/session";
import { TRANSITION_LABELS, allowedTransitions, formatHashtagsForInput, isDeletable } from "@/lib/content";
import { countSimilarByHash, getContentItem } from "@/lib/data/content";
import { getDb } from "@/lib/data/db";
import { getProject } from "@/lib/data/projects";
import { formatDateTime } from "@/lib/format";
import { formatLabel } from "@/lib/post-formats";
import { languageLabel } from "@/lib/projects";
import { messageForCode } from "@/lib/service-messages";
import { addDays, todayInZone } from "@/lib/campaign-plan";
import { getPostImage } from "@/lib/services/media";
import { isCurrentUserPlatformAdmin } from "@/lib/auth/admin";
import { getItemScheduling } from "@/lib/services/scheduling";
import { approvalStatus } from "@/lib/status";
import { deleteContentAction, regenerateAction, setStatusAction } from "../actions";

export const metadata: Metadata = { title: "Post" };

// Regenerating calls the AI and can take a while.
export const maxDuration = 60;

type Props = {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const NOTICES: Record<string, string> = {
  generated: "Draft created. Review and edit it below.",
  created: "Draft created.",
  regenerated: "Regenerated. The post is back in Draft.",
  status: "Status updated.",
  image_added: "Image added to the post.",
  image_added_draft: "Image changed. The post is back in Draft so it can be approved again.",
  image_removed: "Image removed from the post.",
  image_removed_draft: "Image removed. The post is back in Draft so it can be approved again.",
  scheduled: "Post scheduled.",
  schedule_changed: "Schedule changed.",
  schedule_canceled: "Schedule canceled.",
  schedule_retried: "The post was queued to publish again.",
  marked_published: "Marked as published.",
};

export default async function ContentItemPage({ params, searchParams }: Props) {
  const { itemId } = await params;
  if (!z.string().uuid().safeParse(itemId).success) return notFound();

  const ctx = await requireAppContext();
  const db = await getDb();
  const item = await getContentItem(db, ctx.workspace.id, itemId);
  if (!item) return notFound();

  const [project, similar, image, scheduling] = await Promise.all([
    item.project_id ? getProject(db, ctx.workspace.id, item.project_id) : Promise.resolve(null),
    item.content_hash ? countSimilarByHash(db, ctx.workspace.id, item.content_hash, item.id) : Promise.resolve(0),
    getPostImage(ctx, item.id),
    getItemScheduling(ctx, item.id),
  ]);

  const sp = await searchParams;
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const error = messageForCode(sp.error);
  const writable = canWrite(ctx.role);
  const meta = approvalStatus[item.approval_status];
  const flags = item.usage_metadata?.fact_check_flags ?? [];
  const canRegenerate = writable && Boolean(item.project_id && item.usage_metadata?.request);
  const transitions = writable ? allowedTransitions(item.approval_status) : [];

  return (
    <div className="space-y-6">
      <Link href="/app/content" className="text-sm font-medium text-ink-500 hover:text-ink">
        ← Content
      </Link>

      <PageHeader
        title={item.hook || "Post"}
        description={[
          languageLabel(item.language),
          item.content_format === "text" ? "Written by you" : formatLabel(item.content_format),
          project ? project.name : null,
          `Updated ${formatDateTime(item.updated_at, ctx.workspace.timezone)}`,
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

      {flags.length > 0 ? (
        <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Check these claims before you publish
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {flags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {item.usage_metadata?.source ? (
        <p className="text-sm text-ink-600">
          Based on{" "}
          <a
            href={item.usage_metadata.source.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="font-medium text-brand hover:underline"
          >
            {item.usage_metadata.source.title || item.usage_metadata.source.url}
          </a>
          . The post is written in our own words, and the link is included at the end.
        </p>
      ) : null}

      {similar > 0 ? (
        <p role="note" className="rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-700">
          This wording is very similar to {similar === 1 ? "another post" : `${similar} other posts`} in your workspace.
        </p>
      ) : null}

      {writable ? (
        <section className="max-w-2xl rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <ContentEditor
            itemId={item.id}
            defaults={{
              hook: item.hook ?? "",
              body: item.body,
              cta: item.cta ?? "",
              hashtags: formatHashtagsForInput(item.hashtags ?? []),
              imageBrief: item.image_brief ?? "",
            }}
          />
        </section>
      ) : (
        <section className="max-w-2xl space-y-3 rounded-2xl border border-ink-100 bg-white p-6 text-sm shadow-card">
          {item.hook ? <p className="font-semibold">{item.hook}</p> : null}
          <p className="whitespace-pre-wrap break-words leading-relaxed">{item.body}</p>
          {item.cta ? <p>{item.cta}</p> : null}
          <p className="text-ink-500">You have read-only access to this workspace.</p>
        </section>
      )}

      <PostImageCard itemId={item.id} image={image} canEdit={writable} imageBrief={item.image_brief} />

      <ScheduleCard
        itemId={item.id}
        approved={item.approval_status === "approved"}
        canEdit={writable}
        data={scheduling}
        timeZone={ctx.workspace.timezone}
        defaultWhen={`${addDays(todayInZone(new Date(), ctx.workspace.timezone), 1)}T10:00`}
        nowIso={new Date().toISOString()}
        isPlatformAdmin={await isCurrentUserPlatformAdmin()}
      />

      {item.ai_model ? (
        <p className="text-xs text-ink-500">
          Written with AI ({item.ai_provider} · {item.ai_model}). Always review AI text for accuracy before publishing.
        </p>
      ) : null}

      {writable ? (
        <section className="max-w-2xl space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <h2 className="font-display text-lg font-bold">Review</h2>
          <div className="flex flex-wrap gap-3">
            {transitions.map((to) => (
              <form key={to} action={setStatusAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="to" value={to} />
                <Button type="submit" variant={to === "awaiting_approval" || to === "approved" ? "primary" : "secondary"}>
                  {TRANSITION_LABELS[to]}
                </Button>
              </form>
            ))}
          </div>

          {canRegenerate ? (
            <form action={regenerateAction} className="space-y-2 border-t border-ink-100 pt-4">
              <input type="hidden" name="itemId" value={item.id} />
              <PendingButton pendingLabel="Regenerating… this can take up to a minute">Regenerate with AI</PendingButton>
              <p className="text-xs text-ink-500">Replaces the current text with a new version and moves the post back to Draft.</p>
            </form>
          ) : null}

          {isDeletable(item.approval_status) ? (
            <details className="border-t border-ink-100 pt-4">
              <summary className="cursor-pointer list-none text-sm font-semibold text-red-700 [&::-webkit-details-marker]:hidden">
                Delete post…
              </summary>
              <form action={deleteContentAction} className="mt-3 space-y-3">
                <input type="hidden" name="itemId" value={item.id} />
                <p className="text-sm text-ink-700">This permanently deletes the post. It cannot be undone.</p>
                <button type="submit" className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                  Yes, delete this post
                </button>
              </form>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
