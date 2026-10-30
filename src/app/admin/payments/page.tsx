import type { Metadata } from "next";
import { approveRefundAction, declineRefundAction } from "@/app/admin/payments/actions";
import { BkashForm } from "@/components/admin/bkash-form";
import { PendingButton } from "@/components/ui/pending-button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { getBillingCurrency } from "@/lib/data/plans";
import { listRecentPayments, listRefundRequests, readBkashSettings } from "@/lib/data/payments";
import { formatPrice } from "@/lib/pricing";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

const TONE = { completed: "green", created: "amber", failed: "amber", canceled: "neutral", refunded: "brand" } as const;
const NOTICES: Record<string, string> = { refunded: "Refund sent through bKash. The payment is marked refunded.", declined: "Refund request declined." };
const ERRORS: Record<string, string> = {
  invalid: "That request was not valid.",
  refund_failed: "bKash did not complete the refund. Nothing was changed; check the bKash portal before trying again.",
  refund_not_refundable: "This payment cannot be refunded (it is not completed, or it was already refunded).",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PaymentsAdminPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [settings, payments, currency, requests] = await Promise.all([readBkashSettings(), listRecentPayments().catch(() => null), getBillingCurrency(), listRefundRequests().catch(() => [])]);
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const saved = Boolean(settings.appKey && settings.appSecret && settings.username && settings.password);
  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="bKash checkout for paid plans. Start in sandbox mode with test credentials." />

      {notice ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {currency !== "BDT" ? (
        <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The site currency is {currency}, but bKash only takes Bangladeshi taka (BDT), so checkout stays closed. Change the currency in Admin, Plans.
        </p>
      ) : null}

      <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">bKash (Tokenized Checkout)</h2>
          <Badge tone={settings.enabled ? "green" : "neutral"}>{settings.enabled ? `On (${settings.mode})` : "Off"}</Badge>
        </div>
        <div className="mt-4">
          <BkashForm enabled={settings.enabled} mode={settings.mode} saved={saved} />
        </div>
      </section>

      {requests.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-display text-lg font-bold">Refund requests ({requests.length})</h2>
          <ul className="mt-3 space-y-3">
            {requests.map((p) => (
              <li key={p.id} className="rounded-xl bg-white p-4 text-sm shadow-card">
                <p>
                  <strong>{formatPrice(p.amount, "BDT")}</strong> for {p.plan_key} ({p.period}), invoice <span className="font-mono text-xs">{p.invoice_number}</span>
                </p>
                <p className="mt-1 text-ink-600">Reason: {p.refund_reason}</p>
                <p className="mt-1 text-xs text-ink-500">Approving sends the full amount back through bKash and moves the workspace to Free if it is still on this plan.</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <form action={approveRefundAction}>
                    <input type="hidden" name="paymentId" value={p.id} />
                    <PendingButton pendingLabel="Refunding…" variant="primary">Approve and refund</PendingButton>
                  </form>
                  <form action={declineRefundAction}>
                    <input type="hidden" name="paymentId" value={p.id} />
                    <PendingButton pendingLabel="Saving…">Decline</PendingButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Recent payments</h2>
        {payments && payments.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Invoice</th>
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">bKash transaction</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(p.created_at).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.invoice_number}</td>
                    <td className="py-2 pr-4">{p.plan_key} ({p.period})</td>
                    <td className="py-2 pr-4">{formatPrice(p.amount, "BDT")}</td>
                    <td className="py-2 pr-4"><Badge tone={TONE[p.status]}>{p.status}{p.failure_code ? `: ${p.failure_code}` : ""}</Badge></td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.provider_trx_id ?? "-"}</td>
                    <td className="py-2 pr-4">
                      {p.status === "completed" ? (
                        <form action={approveRefundAction}>
                          <input type="hidden" name="paymentId" value={p.id} />
                          <PendingButton pendingLabel="Refunding…">Refund in full</PendingButton>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-600">{payments ? "No payments yet." : "Payments are not available. Check that migration 0016 was run."}</p>
        )}
        <p className="mt-3 text-xs text-ink-500">Refunds return the full amount through bKash. Customers can ask for a refund from their Billing page; you approve it above.</p>
      </section>
    </div>
  );
}
