import "server-only";
import { getUserName } from "@/lib/data/email";
import { getPayment, getWorkspacePlanState, listWorkspacesEndingSoon, type PlanTimingRow } from "@/lib/data/payments";
import { listPlans } from "@/lib/data/plans";
import { adminDb } from "@/lib/data/platform";
import { PERIOD_LABELS } from "@/lib/payments/billing";
import { ENDING_SOON_DAYS, daysUntil, endedKey, endingSoonKey, formatEndDate, receiptKey } from "@/lib/plan-emails";
import { formatPrice } from "@/lib/pricing";
import { sendNotification } from "./email";

/** Payment and plan emails. Like every notification they never throw, and the delivery log stops a second copy. */

async function planNames(): Promise<Record<string, string>> {
  try {
    return Object.fromEntries((await listPlans(adminDb())).map((p) => [p.key, p.name]));
  } catch {
    return {};
  }
}

export async function notifyPaymentReceipt(paymentId: string): Promise<void> {
  try {
    const payment = await getPayment(paymentId);
    if (!payment || payment.status !== "completed") return;
    const [names, state, name] = await Promise.all([planNames(), getWorkspacePlanState(payment.workspace_id), getUserName(payment.user_id).catch(() => null)]);
    await sendNotification({
      data: {
        template: "payment_receipt",
        name,
        invoice: payment.invoice_number,
        planName: names[payment.plan_key] ?? payment.plan_key,
        periodLabel: PERIOD_LABELS[payment.period],
        amountText: formatPrice(payment.amount, "BDT"),
        endsOn: state.plan_expires_at ? formatEndDate(state.plan_expires_at) : null,
      },
      userId: payment.user_id,
      workspaceId: payment.workspace_id,
      dedupeKey: receiptKey(payment.id),
      preference: null,
    });
  } catch {
    // The receipt is a courtesy; the payment itself is already recorded.
  }
}

/** Emails the owners of plans that end within a week. Returns how many were sent. */
export async function sendEndingSoonNotices(): Promise<number> {
  const [rows, names] = await Promise.all([listWorkspacesEndingSoon(ENDING_SOON_DAYS), planNames()]);
  let sent = 0;
  for (const row of rows) {
    const name = await getUserName(row.owner_id).catch(() => null);
    const result = await sendNotification({
      data: { template: "plan_ending_soon", name, planName: names[row.plan] ?? row.plan, endsOn: formatEndDate(row.plan_expires_at), days: daysUntil(row.plan_expires_at) },
      userId: row.owner_id,
      workspaceId: row.id,
      dedupeKey: endingSoonKey(row.id, row.plan_expires_at),
      preference: null,
    });
    if (result.status === "sent") sent += 1;
  }
  return sent;
}

/** Emails the owners of plans that have just ended (the rows were read before the workspaces went back to Free). */
export async function sendEndedNotices(rows: PlanTimingRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const names = await planNames();
  let sent = 0;
  for (const row of rows) {
    const name = await getUserName(row.owner_id).catch(() => null);
    const result = await sendNotification({
      data: { template: "plan_ended", name, planName: names[row.plan] ?? row.plan },
      userId: row.owner_id,
      workspaceId: row.id,
      dedupeKey: endedKey(row.id, row.plan_expires_at),
      preference: null,
    });
    if (result.status === "sent") sent += 1;
  }
  return sent;
}
