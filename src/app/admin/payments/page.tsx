import type { Metadata } from "next";
import { BkashForm } from "@/components/admin/bkash-form";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { getBillingCurrency } from "@/lib/data/plans";
import { listRecentPayments, readBkashSettings } from "@/lib/data/payments";
import { formatPrice } from "@/lib/pricing";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

const TONE = { completed: "green", created: "amber", failed: "amber", canceled: "neutral" } as const;

export default async function PaymentsAdminPage() {
  const [settings, payments, currency] = await Promise.all([readBkashSettings(), listRecentPayments().catch(() => null), getBillingCurrency()]);
  const saved = Boolean(settings.appKey && settings.appSecret && settings.username && settings.password);
  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="bKash checkout for paid plans. Start in sandbox mode with test credentials." />

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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-600">{payments ? "No payments yet." : "Payments are not available. Check that migration 0016 was run."}</p>
        )}
        <p className="mt-3 text-xs text-ink-500">Refunds are made in the bKash merchant portal. After a refund, change the workspace plan in Admin, Plans.</p>
      </section>
    </div>
  );
}
