import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireAppContext } from "@/lib/auth/session";
import { describeAuditEvent } from "@/lib/audit";
import { getDb } from "@/lib/data/db";
import { listAuditEvents } from "@/lib/data/overview";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const ctx = await requireAppContext();
  const events = await listAuditEvents(await getDb(), ctx.workspace.id);

  return (
    <div className="space-y-6">
      <PageHeader title="Activity" description="What has happened in your workspace, newest first." />

      {events.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          body="Creating projects, approving posts, and publishing will show up here."
        />
      ) : (
        <ul className="divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white shadow-card">
          {events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
              <p className="text-sm font-medium">{describeAuditEvent(event)}</p>
              <p className="text-xs text-ink-500">
                {event.actor_user_id === ctx.user.id ? "You" : event.actor_user_id ? "Teammate" : "LazyAI"} ·{" "}
                {formatDateTime(event.created_at, ctx.workspace.timezone)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
