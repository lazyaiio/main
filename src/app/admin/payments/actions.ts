"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import type { FormState } from "@/lib/auth/form-state";
import { readBkashSettings, writeBkashSettings, type BkashSettings } from "@/lib/data/payments";
import { BkashError, grantToken } from "@/lib/payments/bkash";
import { approveRefund, declineRefund, openCredentials, sealCredential } from "@/lib/services/billing";
import { ServiceError } from "@/lib/services/errors";

const FIELDS = ["appKey", "appSecret", "username", "password"] as const;
const text = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
};

export async function saveBkashAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePlatformAdmin();
  const current = await readBkashSettings();
  const mode = text(formData, "mode") === "live" ? "live" : "sandbox";
  const enabled = formData.get("enabled") === "on";

  // Real money: switching to live needs a typed confirmation, every time the mode changes to live.
  if (mode === "live" && current.mode !== "live" && text(formData, "confirmLive") !== "LIVE") {
    return { error: "To switch to live mode (real money), type LIVE in the confirmation box." };
  }

  const next: BkashSettings = { ...current, mode, enabled };
  try {
    for (const field of FIELDS) {
      const value = text(formData, field);
      if (value) {
        if (value.length > 300) return { error: "One of the values is too long." };
        next[field] = sealCredential(field, value);
      }
    }
  } catch (error) {
    return { error: error instanceof ServiceError ? error.message : "Could not store the credentials." };
  }
  if (enabled && FIELDS.some((f) => !next[f])) return { error: "Fill in all four credentials before turning payments on." };
  // Credentials from sandbox do not work live (and the other way round), so a mode change turns payments off to be re-checked.
  if (mode !== current.mode) next.enabled = false;

  try {
    await writeBkashSettings(next, ctx.user.id);
  } catch {
    return { error: "Could not save. Check that migration 0011 was run and the Supabase service key is set." };
  }
  revalidatePath("/admin/payments");
  return { success: true, message: mode !== current.mode ? "Saved. The mode changed, so payments were switched off: test the connection, then turn them on." : "Saved." };
}

export async function testBkashAction(): Promise<FormState> {
  await requirePlatformAdmin();
  const creds = openCredentials(await readBkashSettings());
  if (!creds) return { error: "Save all four credentials first." };
  try {
    await grantToken(creds);
    return { success: true, message: `Connected to bKash (${creds.mode}). The credentials are accepted.` };
  } catch (error) {
    return { error: error instanceof BkashError ? error.message : "The connection test failed." };
  }
}

const idSchema = z.string().uuid();

/** Approve a refund (asked for by the customer, or started by the admin): bKash is asked to return the full amount. */
export async function approveRefundAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = idSchema.safeParse(formData.get("paymentId"));
  if (!id.success) redirect("/admin/payments?error=invalid");
  let outcome: string;
  try {
    outcome = await approveRefund(id.data);
  } catch {
    outcome = "failed";
  }
  revalidatePath("/admin/payments");
  redirect(`/admin/payments?${outcome === "refunded" ? "notice=refunded" : `error=refund_${outcome}`}`);
}

export async function declineRefundAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = idSchema.safeParse(formData.get("paymentId"));
  if (!id.success) redirect("/admin/payments?error=invalid");
  try {
    await declineRefund(id.data);
  } catch {
    redirect("/admin/payments?error=refund_failed");
  }
  revalidatePath("/admin/payments");
  redirect("/admin/payments?notice=declined");
}
