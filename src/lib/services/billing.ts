import "server-only";
import type { AppContext } from "@/lib/auth/session";
import { canAdmin } from "@/lib/auth/permissions";
import { decryptToken, encryptToken } from "@/lib/crypto/token-crypto";
import { getDb } from "@/lib/data/db";
import { getBillingCurrency, listVisiblePlans } from "@/lib/data/plans";
import { applyPaidPlan, getPayment, getWorkspacePlanState, insertPayment, readBkashSettings, updatePayment, type BkashSettings } from "@/lib/data/payments";
import { getPublicEnv } from "@/lib/env";
import { logError } from "@/lib/log";
import { checkoutOpen, priceFor, type Period } from "@/lib/payments/billing";
import { BkashError, confirmsExpected, createPayment, executePayment, queryPayment, type BkashCredentials } from "@/lib/payments/bkash";
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

/** Starts a checkout and returns the bKash page to send the person to. */
export async function startCheckout(ctx: AppContext, planKey: string, period: Period): Promise<string> {
  if (!canAdmin(ctx.role)) throw new ServiceError("forbidden", "Only the owner or an admin of the workspace can change the plan.");
  const [creds, currency] = await Promise.all([activeCredentials(), getBillingCurrency()]);
  if (!creds || !checkoutOpen(currency)) throw new ServiceError("not_configured", "Online payment is not available yet.");

  await enforceRate(await getDb(), "checkout", 10, 3600);

  const plan = (await listVisiblePlans()).find((p) => p.key === planKey);
  if (!plan) throw new ServiceError("not_found", "That plan is not available.");
  const amount = priceFor(
    { key: plan.key, priceMonthly: plan.price_monthly, priceYearly: plan.price_yearly, priceLifetime: plan.price_lifetime, lifetimeAvailable: plan.lifetime_available },
    period,
  );
  if (amount === null) throw new ServiceError("not_found", "That plan cannot be bought this way.");

  const state = await getWorkspacePlanState(ctx.workspace.id);
  if (state.plan === plan.key && state.plan_period === "lifetime") throw new ServiceError("failed", "You already have this plan for life.");

  const payment = await insertPayment({ workspaceId: ctx.workspace.id, userId: ctx.user.id, planKey: plan.key, period, amount });
  try {
    const callbackUrl = `${getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/payments/bkash/callback?pid=${payment.id}`;
    const created = await createPayment(creds, { amount, invoiceNumber: payment.invoice_number, callbackUrl, payerReference: ctx.user.id.slice(0, 20) });
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
