import "server-only";
import type { AppContext } from "@/lib/auth/session";
import { canAdmin } from "@/lib/auth/permissions";
import { decryptToken, encryptToken } from "@/lib/crypto/token-crypto";
import { getDb } from "@/lib/data/db";
import { getBillingCurrency, listVisiblePlans } from "@/lib/data/plans";
import { applyPaidPlan, applyRefund, getPayment, setRefundFields, getWorkspacePlanState, insertPayment, readBkashSettings, updatePayment, type BkashSettings } from "@/lib/data/payments";
import { getPublicEnv } from "@/lib/env";
import { logError } from "@/lib/log";
import { checkoutOpen, priceFor, type Period } from "@/lib/payments/billing";
import { BkashError, confirmsExpected, createPayment, executePayment, queryPayment, refundPayment, type BkashCredentials } from "@/lib/payments/bkash";
import { getTokenEncryptionKey } from "@/lib/social/keys";
import { ServiceError } from "./errors";
import { enforceRate } from "./plans";

export const bkashContext = (field: string) => `bkash:${field}`;

/** Encrypts one credential for storage. */
export function sealCredential(field: string, value: string): string {
  const secret = getTokenEncryptionKey();
  if (!secret) throw new ServiceError("not_configured", "TOKEN_ENCRYPTION_KEY is not set, so credentials cannot be stored safely.");
  return encryptToken(secret, bkashContext(field), value);
}

function openCredential(field: string, sealed: string | null): string | null {
  const secret = getTokenEncryptionKey();
  if (!secret || !sealed) return null;
  try {
    return decryptToken(secret, bkashContext(field), sealed);
  } catch {
    return null;
  }
}

export function openCredentials(settings: BkashSettings): BkashCredentials | null {
  const appKey = openCredential("appKey", settings.appKey);
  const appSecret = openCredential("appSecret", settings.appSecret);
  const username = openCredential("username", settings.username);
  const password = openCredential("password", settings.password);
  if (!appKey || !appSecret || !username || !password) return null;
  return { mode: settings.mode, appKey, appSecret, username, password };
}

/** Credentials for checkout, or null when payments are switched off or not set up. */
async function activeCredentials(): Promise<BkashCredentials | null> {
  const settings = await readBkashSettings();
  return settings.enabled ? openCredentials(settings) : null;
}

export async function paymentsAvailable(): Promise<boolean> {
  try {
    const [creds, currency] = await Promise.all([activeCredentials(), getBillingCurrency()]);
    return creds !== null && checkoutOpen(currency);
  } catch {
    return false;
  }
}

/** Starts a checkout for a signed-in person and returns the bKash page to send them to. */
export async function startCheckout(ctx: AppContext, planKey: string, period: Period): Promise<string> {
  if (!canAdmin(ctx.role)) throw new ServiceError("forbidden", "Only the owner or an admin of the workspace can change the plan.");
  await enforceRate(await getDb(), "checkout", 10, 3600);
  return beginPayment({ userId: ctx.user.id, workspaceId: ctx.workspace.id }, planKey, period);
}

/** Who is paying. Used directly right after sign-up, before the browser has the new session cookie. */
export type PaymentActor = { userId: string; workspaceId: string };

/** Creates the payment record and the bKash payment. The caller has already checked the person's right to buy. */
export async function beginPayment(actor: PaymentActor, planKey: string, period: Period): Promise<string> {
  const [creds, currency] = await Promise.all([activeCredentials(), getBillingCurrency()]);
  if (!creds || !checkoutOpen(currency)) throw new ServiceError("not_configured", "Online payment is not available yet.");

  const plan = (await listVisiblePlans()).find((p) => p.key === planKey);
  if (!plan) throw new ServiceError("not_found", "That plan is not available.");
  const amount = priceFor(
    { key: plan.key, priceMonthly: plan.price_monthly, priceYearly: plan.price_yearly, priceLifetime: plan.price_lifetime, lifetimeAvailable: plan.lifetime_available },
    period,
  );
  if (amount === null) throw new ServiceError("not_found", "That plan cannot be bought this way.");

  const state = await getWorkspacePlanState(actor.workspaceId);
  if (state.plan === plan.key && state.plan_period === "lifetime") throw new ServiceError("failed", "You already have this plan for life.");

  const payment = await insertPayment({ workspaceId: actor.workspaceId, userId: actor.userId, planKey: plan.key, period, amount });
  try {
    const callbackUrl = `${getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/payments/bkash/callback?pid=${payment.id}`;
    const created = await createPayment(creds, { amount, invoiceNumber: payment.invoice_number, callbackUrl, payerReference: actor.userId.slice(0, 20) });
    await updatePayment(payment.id, { provider_payment_id: created.paymentId });
    return created.redirectUrl;
  } catch (error) {
    await updatePayment(payment.id, { status: "failed", failure_code: "start_failed" }).catch(() => undefined);
    logError("billing.start_failed", { code: error instanceof BkashError ? error.code : "unknown" });
    throw new ServiceError("failed", error instanceof BkashError ? error.message : "The payment could not be started. Please try again.");
  }
}

export type CheckoutOutcome = "paid" | "canceled" | "failed" | "unknown";

/**
 * Called when bKash sends the customer back. The outcome is decided by asking bKash (execute, then query),
 * and the amount and invoice are compared with our own record. The query string is never trusted.
 */
export async function finishCheckout(paymentRowId: string, bkashPaymentId: string | null, callbackStatus: string | null): Promise<CheckoutOutcome> {
  const payment = await getPayment(paymentRowId);
  if (!payment) return "unknown";
  if (payment.status === "completed") return "paid";
  if (payment.status === "failed" || payment.status === "canceled") return payment.status === "canceled" ? "canceled" : "failed";
  if (!payment.provider_payment_id || payment.provider_payment_id !== bkashPaymentId) return "unknown";

  if (callbackStatus === "cancel") {
    await updatePayment(payment.id, { status: "canceled", failure_code: "customer_canceled" });
    return "canceled";
  }
  if (callbackStatus !== "success") {
    await updatePayment(payment.id, { status: "failed", failure_code: "not_successful" });
    return "failed";
  }

  const creds = await activeCredentials();
  if (!creds) return "unknown"; // Settings changed meanwhile; the payment stays open for a retry of this link.

  try {
    let result = await executePayment(creds, payment.provider_payment_id);
    if (result.status !== "completed") {
      // Execute may already have run (for example, the page was refreshed). Ask for the final state.
      result = await queryPayment(creds, payment.provider_payment_id);
    }
    if (confirmsExpected(result, { amount: payment.amount, invoiceNumber: payment.invoice_number })) {
      await updatePayment(payment.id, { provider_trx_id: result.trxId });
      await applyPaidPlan(payment.id);
      return "paid";
    }
    const mismatch = result.status === "completed";
    if (mismatch) logError("billing.mismatch", { payment: payment.id });
    await updatePayment(payment.id, { status: "failed", failure_code: mismatch ? "mismatch" : "declined" });
    return "failed";
  } catch (error) {
    // Could not reach bKash: keep the payment open so the same link can be tried again.
    logError("billing.finish_failed", { code: error instanceof BkashError ? error.code : "unknown" });
    return "unknown";
  }
}

/** A workspace owner or admin asks for a refund of a completed payment. A platform admin decides. */
export async function requestRefund(ctx: AppContext, paymentId: string, reason: string): Promise<void> {
  if (!canAdmin(ctx.role)) throw new ServiceError("forbidden", "Only the owner or an admin of the workspace can ask for a refund.");
  const cleaned = reason.trim().replace(/\s+/g, " ").slice(0, 300);
  if (cleaned.length < 3) throw new ServiceError("failed", "Please tell us briefly why you want a refund.");
  await enforceRate(await getDb(), "refund_request", 5, 3600);
  // The person's own session reads the payment, so only payments of their workspace can be found.
  const { data } = await (await getDb()).from("payments").select("id, status, refund_status").eq("id", paymentId).eq("workspace_id", ctx.workspace.id).maybeSingle();
  const payment = data as { id: string; status: string; refund_status: string | null } | null;
  if (!payment) throw new ServiceError("not_found", "That payment could not be found.");
  if (payment.status !== "completed") throw new ServiceError("failed", "Only completed payments can be refunded.");
  if (payment.refund_status === "requested" || payment.refund_status === "refunded") throw new ServiceError("failed", "A refund was already requested for this payment.");
  await setRefundFields(payment.id, { refund_status: "requested", refund_reason: cleaned, refund_requested_at: new Date().toISOString() });
}

export type RefundOutcome = "refunded" | "failed" | "not_refundable";

/** Platform admin approved: ask bKash to send the money back, then record it. The full amount is returned. */
export async function approveRefund(paymentId: string): Promise<RefundOutcome> {
  const payment = await getPayment(paymentId);
  if (!payment || payment.status !== "completed" || !payment.provider_payment_id || !payment.provider_trx_id) return "not_refundable";
  const creds = await activeCredentials();
  if (!creds) throw new ServiceError("not_configured", "bKash is not set up or is switched off.");
  try {
    const result = await refundPayment(creds, {
      paymentId: payment.provider_payment_id,
      trxId: payment.provider_trx_id,
      amount: payment.amount,
      reason: payment.refund_reason ?? "Refund approved",
    });
    if (result.status !== "completed" || !result.refundTrxId) {
      await setRefundFields(payment.id, { refund_status: "failed" });
      return "failed";
    }
    await applyRefund(payment.id, result.refundTrxId);
    return "refunded";
  } catch (error) {
    logError("billing.refund_failed", { code: error instanceof BkashError ? error.code : "unknown" });
    await setRefundFields(payment.id, { refund_status: "failed" }).catch(() => undefined);
    return "failed";
  }
}

export async function declineRefund(paymentId: string): Promise<void> {
  await setRefundFields(paymentId, { refund_status: "declined" });
}
