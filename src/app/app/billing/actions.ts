"use server";

import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { isPeriod } from "@/lib/payments/billing";
import { requestRefund, startCheckout } from "@/lib/services/billing";
import { ServiceError } from "@/lib/services/errors";

/** Starts a bKash checkout for the chosen plan and period, then sends the person to bKash. */
export async function startCheckoutAction(formData: FormData): Promise<void> {
  const ctx = await requireAppContext();
  const plan = formData.get("plan");
  const period = formData.get("period");
  if (typeof plan !== "string" || !/^[a-z0-9_]{2,30}$/.test(plan) || !isPeriod(period)) redirect("/app/billing?error=invalid");

  let url: string;
  try {
    url = await startCheckout(ctx, plan, period);
  } catch (error) {
    const code = error instanceof ServiceError ? error.kind : "failed";
    redirect(`/app/billing?error=${encodeURIComponent(code)}`);
  }
  redirect(url);
}

export async function requestRefundAction(formData: FormData): Promise<void> {
  const ctx = await requireAppContext();
  const id = formData.get("paymentId");
  const reason = formData.get("reason");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id) || typeof reason !== "string") redirect("/app/billing?error=invalid");
  try {
    await requestRefund(ctx, id, reason);
  } catch (error) {
    redirect(`/app/billing?error=${encodeURIComponent(error instanceof ServiceError ? error.kind : "failed")}`);
  }
  redirect("/app/billing?notice=refund_requested");
}
