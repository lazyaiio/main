import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Inbox } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { countByStatus, getMessage, listMessages, type SupportRow } from "@/lib/data/support";
import { formatDateTime } from "@/lib/format";
import { STATUS_LABELS, TOPIC_LABELS, isSupportStatus, type SupportStatus } from "@/lib/support";
import { changeStatusAction, saveNoteAction, sendReplyAction } from "./actions";

export const metadata: Metadata = { title: "Support" };
export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  status: "Status changed.",
  note: "Note saved.",
  replied: "Reply sent by email.",
};
const ERRORS: Record<string, string> = {
  invalid: "That did not look right. Please try again.",
  failed: "Something went wrong. Please try again.",
  reply_invalid: "Write your reply first (at least a few words, under 4,000 characters).",
  email_not_configured: "Email is not set up, so nothing was sent. Add the Resend settings (see Admin, then Email).",
  reply_failed: "The reply could not be sent. Check Admin, then Email, and try again.",
};
const STATUS_TONE: Record<SupportStatus, BadgeTone> = { new: "brand", open: "amber", closed: "neutral" };
const FILTERS: { value: SupportStatus | "all"; label: string }[] = [
  { value: "new", label: "New" },
  { value: "open", label: "In progress" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

type SearchParams = Promise<{ status?: string; id?: string; notice?: string; error?: string }>;

export default async function SupportAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePlatformAdmin();
  const params = await searchParams;
  const filter: SupportStatus | "all" = params.status === "all" ? "all" : isSupportStatus(params.status) ? params.status : "new";
  const tz = ctx.workspace.timezone;

  let rows: SupportRow[] | null = null;
  let counts: Record<SupportStatus, number> | null = null;
  let selected: SupportRow | null = null;
  try {
    [rows, counts] = await Promise.all([listMessages(filter), countByStatus()]);
    if (params.id && /^[0-9a-f-]{36}$/i.test(params.id)) selected = await getMessage(params.id);
  } catch {
    rows = null;
  }

  const notice = params.notice ? NOTICES[params.notice] : undefined;
  const error = params.error ? (ERRORS[params.error] ?? ERRORS.failed) : undefined;
  const hidden = (id: string) => (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="filter" value={filter} />
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Support" description="Messages from the Contact form. Reply by email, add private notes, and close a message when it is done." />

      {notice ? (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" /> {error}
        </p>
      ) : null}

      <nav aria-label="Filter messages" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.value === filter;
          const count = counts && f.value !== "all" ? counts[f.value] : null;
          return (
            <Link
              key={f.value}
              href={`/admin/support?status=${f.value}`}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${active ? "bg-brand text-white" : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50"}`}
            >
              {f.label}
              {count !== null ? ` (${count})` : ""}
            </Link>
          );
        })}
      </nav>

      {rows === null ? (
        <p role="alert" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          The messages could not be loaded. Run migration 0023 in Supabase (see docs/SUPPORT_SETUP.md) and check that the service key is set.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Inbox} title="No messages here" body="New messages from the Contact form show up in this list." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white">
            {rows.map((row) => {
              const active = selected?.id === row.id;
              return (
                <li key={row.id}>
                  <Link
                    href={`/admin/support?status=${filter}&id=${row.id}`}
                    aria-current={active ? "true" : undefined}
                    className={`block px-4 py-3 hover:bg-ink-50 ${active ? "bg-brand-50" : ""}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{row.name}</span>
                      <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-ink-700">{row.subject || TOPIC_LABELS[row.topic]}</span>
                    <span className="mt-0.5 block truncate text-xs text-ink-500">
                      {formatDateTime(row.created_at, tz)}
                      {row.replied_at ? " · replied" : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <section aria-label="Message" className="rounded-2xl border border-ink-100 bg-white p-6">
            {selected ? (
              <div className="space-y-5">
                <header>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold">{selected.subject || TOPIC_LABELS[selected.topic]}</h2>
                    <Badge tone={STATUS_TONE[selected.status]}>{STATUS_LABELS[selected.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">
                    {selected.name} · {selected.email}
                  </p>
                  <p className="text-xs text-ink-500">
                    {TOPIC_LABELS[selected.topic]} · {formatDateTime(selected.created_at, tz)}
                    {selected.replied_at ? ` · last reply ${formatDateTime(selected.replied_at, tz)}` : ""}
                  </p>
                </header>

                <p className="whitespace-pre-wrap break-words rounded-xl bg-ink-50 p-4 text-sm text-ink-800">{selected.message}</p>

                <form action={sendReplyAction} className="space-y-2">
                  {hidden(selected.id)}
                  <label htmlFor="reply-body" className="block text-sm font-medium text-ink-700">
                    Reply by email to {selected.email}
                  </label>
                  <textarea
                    id="reply-body"
                    name="body"
                    rows={6}
                    required
                    minLength={5}
                    maxLength={4000}
                    aria-describedby="reply-hint"
                    className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                  <p id="reply-hint" className="text-xs text-ink-500">
                    This sends a real email to the person. Write it in English or in the language they used. Their original message is added below your reply.
                  </p>
                  <PendingButton variant="primary" pendingLabel="Sending…">
                    Send reply
                  </PendingButton>
                </form>

                <form action={saveNoteAction} className="space-y-2">
                  {hidden(selected.id)}
                  <label htmlFor="note" className="block text-sm font-medium text-ink-700">
                    Private note (only admins see this)
                  </label>
                  <textarea
                    id="note"
                    name="note"
                    rows={3}
                    maxLength={2000}
                    defaultValue={selected.admin_note}
                    className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                  <PendingButton pendingLabel="Saving…">Save note</PendingButton>
                </form>

                <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4">
                  {(["new", "open", "closed"] as const)
                    .filter((s) => s !== selected.status)
                    .map((s) => (
                      <form key={s} action={changeStatusAction}>
                        {hidden(selected.id)}
                        <input type="hidden" name="newStatus" value={s} />
                        <PendingButton pendingLabel="Saving…">{s === "closed" ? "Close message" : s === "open" ? "Mark in progress" : "Mark as new"}</PendingButton>
                      </form>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-600">Choose a message from the list to read it and reply.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
