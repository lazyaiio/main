import type { Metadata } from "next";
import Link from "next/link";
import { changePlanAction, restoreAction, suspendAction } from "@/app/admin/users/actions";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { listPlans } from "@/lib/data/plans";
import { adminDb } from "@/lib/data/platform";
import { listAdminUsers, type AdminUserRow } from "@/lib/data/users";
import { USERS_PER_PAGE, cleanSearch, describePlan, parsePage } from "@/lib/users";

export const metadata: Metadata = { title: "People" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const input = "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";
const label = "block text-xs font-semibold uppercase tracking-wide text-ink-500";
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "never");
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 250) : "");

export default async function PeoplePage({ searchParams }: Props) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const page = parsePage(sp.page);
  const notice = str(sp.notice);
  const error = str(sp.error);

  let users: AdminUserRow[] = [];
  let total = 0;
  let loadError = "";
  try {
    ({ users, total } = await listAdminUsers(q, page));
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load the people list.";
  }
  const plans = await listPlans(adminDb()).catch(() => []);
  const pages = Math.max(1, Math.ceil(total / USERS_PER_PAGE));
  const link = (p: number) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader title="People" description="Find an account, change its plan, or suspend and restore it." />
      {notice ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {loadError ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p> : null}

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
        <label className={`${label} min-w-64 flex-1`}>Search by email or name
          <input name="q" defaultValue={q} maxLength={80} placeholder="jane@example.com" className={input} />
        </label>
        <button type="submit" className="h-10 rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-600">Search</button>
        {q ? <Link href="/admin/users" className="h-10 rounded-xl border border-ink-300 px-5 text-sm font-semibold leading-10 text-ink hover:bg-ink-50">Clear</Link> : null}
      </form>

      <p className="text-sm text-ink-600">{total.toLocaleString("en-US")} {total === 1 ? "person" : "people"}{q ? ` match “${q}”` : ""}. Page {page} of {pages}.</p>

      <ul className="space-y-3">
        {users.map((u) => (
          <li key={u.user_id} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-semibold">{u.display_name || "No name"} <span className="font-normal text-ink-600">· {u.email}</span></p>
              {u.suspended ? <Badge tone="amber">Suspended</Badge> : null}
              {u.email_verified ? null : <Badge tone="neutral">Email not verified</Badge>}
              <Badge tone={u.plan && u.plan !== "free" ? "brand" : "neutral"}>{describePlan(u)}</Badge>
            </div>
            <p className="mt-1 text-xs text-ink-500">Joined {day(u.created_at)} · Last sign-in {day(u.last_sign_in_at)}{u.workspace_name ? ` · Workspace: ${u.workspace_name}` : ""}</p>

            <details className="mt-3 rounded-xl bg-ink-50 p-3 text-sm">
              <summary className="cursor-pointer font-semibold">Manage</summary>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {u.workspace_id ? (
                  <form action={changePlanAction} className="space-y-3">
                    <input type="hidden" name="workspaceId" value={u.workspace_id} />
                    <input type="hidden" name="q" value={q} />
                    <input type="hidden" name="page" value={String(page)} />
                    <p className="font-semibold">Change plan</p>
                    <label className={label}>Plan
                      <select name="plan" defaultValue={u.plan ?? "free"} className={input}>
                        {plans.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                      </select>
                    </label>
                    <label className={label}>How it is held
                      <select name="period" defaultValue={u.plan_period ?? "manual"} className={input}>
                        <option value="manual">No end date (until changed)</option>
                        <option value="monthly">Monthly (needs an end date)</option>
                        <option value="yearly">Yearly (needs an end date)</option>
                        <option value="lifetime">Lifetime</option>
                      </select>
                    </label>
                    <label className={label}>Ends on (UTC)
                      <input type="date" name="endsOn" defaultValue={u.plan_expires_at ? u.plan_expires_at.slice(0, 10) : ""} className={input} />
                    </label>
                    <p className="text-xs text-ink-500">Choosing Free ignores the last two fields. When a monthly or yearly plan ends, the workspace goes back to Free.</p>
                    <PendingButton pendingLabel="Saving…" variant="primary">Save plan</PendingButton>
                  </form>
                ) : <p className="text-ink-600">This person has no workspace yet.</p>}

                <div className="space-y-3">
                  <p className="font-semibold">{u.suspended ? "Restore access" : "Suspend"}</p>
                  {u.suspended ? (
                    <form action={restoreAction} className="space-y-3">
                      <input type="hidden" name="userId" value={u.user_id} />
                      <input type="hidden" name="q" value={q} />
                      <input type="hidden" name="page" value={String(page)} />
                      <p className="text-xs text-ink-500">The person can sign in and work again.</p>
                      <PendingButton pendingLabel="Restoring…" variant="primary">Restore account</PendingButton>
                    </form>
                  ) : (
                    <form action={suspendAction} className="space-y-3">
                      <input type="hidden" name="userId" value={u.user_id} />
                      <input type="hidden" name="q" value={q} />
                      <input type="hidden" name="page" value={String(page)} />
                      <label className={label}>Reason (only admins see it)
                        <input name="reason" maxLength={300} className={input} placeholder="for example: payment dispute" />
                      </label>
                      <p className="text-xs text-ink-500">The person cannot sign in and cannot create or change anything. Their content is kept. Scheduled posts that are already set up still go out unless you cancel them.</p>
                      <PendingButton pendingLabel="Suspending…">Suspend account</PendingButton>
                    </form>
                  )}
                </div>
              </div>
            </details>
          </li>
        ))}
        {users.length === 0 && !loadError ? <li className="rounded-2xl border border-ink-100 bg-white p-6 text-sm text-ink-600">No one found.</li> : null}
      </ul>

      {pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm font-semibold">
          {page > 1 ? <Link href={link(page - 1)} className="text-brand hover:underline">Previous</Link> : <span />}
          {page < pages ? <Link href={link(page + 1)} className="text-brand hover:underline">Next</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
