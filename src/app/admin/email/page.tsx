import type { Metadata } from "next";
import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";
import { SendTestEmailForm } from "@/components/admin/send-test-email-form";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireAppContext } from "@/lib/auth/session";
import { getDb } from "@/lib/data/db";
import { listRecentEvents, type EventStatus } from "@/lib/data/email";
import { getEmailSetup } from "@/lib/email/keys";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Email" };
export const dynamic = "force-dynamic";

const TEMPLATE_LABELS: Record<string, string> = {
  welcome: "Welcome",
  campaign_complete: "Campaign finished",
  publish_failed: "Post not published",
  page_attention: "Page needs attention",
  test: "Test",
};

const STATUS_TONE: Record<EventStatus, "green" | "amber" | "neutral" | "brand"> = {
  queued: "neutral",
  skipped: "neutral",
  sent: "brand",
  delivered: "green",
  delayed: "amber",
  bounced: "amber",
  complained: "amber",
  failed: "amber",
};

const REASONS: Record<string, string> = {
  not_configured: "email not set up",
  suppressed: "address paused",
  opted_out: "person opted out",
  no_address: "no address",
  rejected: "provider rejected it",
  rate_limited: "rate limited",
  temporary: "temporary problem",
  invalid: "invalid message",
};

export default async function EmailAdminPage() {
  const ctx = await requireAppContext();
  const setup = getEmailSetup();
  const events = await listRecentEvents(await getDb()).catch(() => null);

  const checks = [
    {
      label: "Sending (Resend)",
      state: setup.sendingReady ? "ok" : "bad",
      detail: setup.sendingReady
        ? "RESEND_API_KEY and RESEND_FROM_EMAIL are set."
        : setup.invalidFrom
          ? "RESEND_FROM_EMAIL is not a valid sender. Use an address like notifications@mail.example.com or LazyAI <notifications@mail.example.com>."
          : `Missing in your hosting settings: ${setup.missing.join(", ")}. Follow docs/EMAIL_SETUP.md.`,
    },
    {
      label: "Delivery reports (webhook)",
      state: setup.webhookReady ? "ok" : "warn",
      detail: setup.webhookReady
        ? "RESEND_WEBHOOK_SECRET is set. Resend can tell LazyAI about deliveries, bounces, and spam complaints."
        : "RESEND_WEBHOOK_SECRET is not set. Emails still send, but delivered, bounced, and complained are not tracked (docs/EMAIL_SETUP.md, step 6).",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title="Email" description="Notification emails sent through Resend: setup checks, a test, and the delivery log." />

      <section aria-label="Checks" className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Checks</h2>
        <ul className="mt-3 divide-y divide-ink-100">
          {checks.map((check) => (
            <li key={check.label} className="flex items-start gap-3 py-3">
              {check.state === "ok" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="OK" />
              ) : check.state === "warn" ? (
                <CircleAlert className="h-5 w-5 shrink-0 text-amber-600" aria-label="Needs attention" />
              ) : (
                <CircleX className="h-5 w-5 shrink-0 text-red-600" aria-label="Problem" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold">{check.label}</p>
                <p className="text-sm text-ink-600">{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-500">Messages are sent from the address in RESEND_FROM_EMAIL. Signed in as {ctx.user.email}.</p>
      </section>

      <section aria-label="Test" className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Send a test</h2>
        <p className="mt-1 max-w-xl text-sm text-ink-600">Sends one real email to your own address, so you can check the sender and the layout.</p>
        <div className="mt-4">
          <SendTestEmailForm />
        </div>
      </section>

      <section aria-label="Log" className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Recent emails</h2>
        {events === null ? (
          <p className="mt-2 text-sm text-ink-600">The log is not available. Check that migration 0012 was run.</p>
        ) : events.length === 0 ? (
          <p className="mt-2 text-sm text-ink-600">Nothing has been sent yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th scope="col" className="py-2 pr-4">When</th>
                  <th scope="col" className="py-2 pr-4">Email</th>
                  <th scope="col" className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap py-2 pr-4">{formatDateTime(event.created_at, ctx.workspace.timezone)}</td>
                    <td className="py-2 pr-4">{TEMPLATE_LABELS[event.template] ?? event.template}</td>
                    <td className="py-2">
                      <Badge tone={STATUS_TONE[event.status]}>{event.status}</Badge>
                      {event.error_code ? <span className="ml-2 text-xs text-ink-500">{REASONS[event.error_code] ?? event.error_code}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-500">The log never stores email addresses or message text.</p>
      </section>
    </div>
  );
}
