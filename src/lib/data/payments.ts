import "server-only";
import { adminDb } from "./platform";
import { DataError, unwrap, type Db } from "./db";
import type { BkashMode } from "@/lib/payments/bkash";
import type { Period } from "@/lib/payments/billing";

/** bKash settings, saved by a platform admin. Every secret value is encrypted before it is stored. */
export type BkashSettings = {
  enabled: boolean;
  mode: BkashMode;
  appKey: string | null;
  appSecret: string | null;
  username: string | null;
  password: string | null;
};

const SETTINGS_KEY = "bkash";
const EMPTY: BkashSettings = { enabled: false, mode: "sandbox", appKey: null, appSecret: null, username: null, password: null };

export async function readBkashSettings(): Promise<BkashSettings> {
  try {
    const { data, error } = await adminDb().from("platform_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
    if (error || !data) return { ...EMPTY };
    const v = (data as { value: Record<string, unknown> }).value ?? {};
    const str = (x: unknown) => (typeof x === "string" && x ? x : null);
    return {
      enabled: v.enabled === true,
      mode: v.mode === "live" ? "live" : "sandbox",
      appKey: str(v.appKey),
      appSecret: str(v.appSecret),
      username: str(v.username),
      password: str(v.password),
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function writeBkashSettings(settings: BkashSettings, userId: string): Promise<void> {
  const { error } = await adminDb()
    .from("platform_settings")
    .upsert({ key: SETTINGS_KEY, value: settings, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: "key" });
  if (error) throw new DataError("Could not save the bKash settings.", error.code);
}

export type PaymentRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  plan_key: string;
  period: Period;
  amount: number;
  currency: string;
  status: "created" | "completed" | "failed" | "canceled" | "refunded";
  invoice_number: string;
  provider_payment_id: string | null;
  provider_trx_id: string | null;
  failure_code: string | null;
  created_at: string;
  completed_at: string | null;
  refund_status: "requested" | "declined" | "refunded" | "failed" | null;
  refund_reason: string | null;
  refund_requested_at: string | null;
  refund_trx_id: string | null;
  refunded_at: string | null;
};

const COLUMNS = "id, workspace_id, user_id, plan_key, period, amount, currency, status, invoice_number, provider_payment_id, provider_trx_id, failure_code, created_at, completed_at, refund_status, refund_reason, refund_requested_at, refund_trx_id, refunded_at";

const normalize = (row: PaymentRow): PaymentRow => ({ ...row, amount: Number(row.amount) });

export async function insertPayment(input: { workspaceId: string; userId: string; planKey: string; period: Period; amount: number }): Promise<PaymentRow> {
  const res = await adminDb()
    .from("payments")
    .insert({ workspace_id: input.workspaceId, user_id: input.userId, plan_key: input.planKey, period: input.period, amount: input.amount, currency: "BDT" })
    .select(COLUMNS)
    .single();
  return normalize(unwrap(res, "start the payment") as PaymentRow);
}

export async function getPayment(id: string): Promise<PaymentRow | null> {
  const res = await adminDb().from("payments").select(COLUMNS).eq("id", id).maybeSingle();
  const row = unwrap(res, "load the payment") as PaymentRow | null;
  return row ? normalize(row) : null;
}

export async function updatePayment(id: string, patch: Partial<Pick<PaymentRow, "status" | "provider_payment_id" | "provider_trx_id" | "failure_code">>): Promise<void> {
  const { error } = await adminDb().from("payments").update(patch).eq("id", id).neq("status", "completed");
  if (error) throw new DataError("Could not update the payment.", error.code);
}

/** Turns a confirmed payment into a plan. Returns false when it was already applied. */
export async function applyPaidPlan(id: string): Promise<boolean> {
  const { data, error } = await adminDb().rpc("apply_paid_plan", { p_payment_id: id });
  if (error) throw new DataError("Could not apply the plan.", error.code);
  return data === true;
}

export async function expirePlans(): Promise<number> {
  const { data, error } = await adminDb().rpc("expire_plans");
  if (error) throw new DataError("Could not expire plans.", error.code);
  return typeof data === "number" ? data : 0;
}

export async function listRecentPayments(limit = 30): Promise<PaymentRow[]> {
  const res = await adminDb().from("payments").select(COLUMNS).order("created_at", { ascending: false }).limit(limit);
  return ((unwrap(res, "load the payments") ?? []) as PaymentRow[]).map(normalize);
}

/** The signed-in person's own workspace payments (the database's row rules decide what is visible). */
export async function listWorkspacePayments(db: Db, ws: string, limit = 20): Promise<PaymentRow[]> {
  const res = await db.from("payments").select(COLUMNS).eq("workspace_id", ws).order("created_at", { ascending: false }).limit(limit);
  return ((unwrap(res, "load your payments") ?? []) as PaymentRow[]).map(normalize);
}

export type WorkspacePlanState = { plan: string; plan_period: Period | null; plan_expires_at: string | null };

/** Read with the service key; the caller passes the workspace of the signed-in session, never one from a form. */
export async function getWorkspacePlanState(ws: string): Promise<WorkspacePlanState> {
  const res = await adminDb().from("workspaces").select("plan, plan_period, plan_expires_at").eq("id", ws).maybeSingle();
  const row = unwrap(res, "load the plan") as WorkspacePlanState | null;
  return row ?? { plan: "free", plan_period: null, plan_expires_at: null };
}

export async function setRefundFields(id: string, patch: Partial<Pick<PaymentRow, "refund_status" | "refund_reason" | "refund_requested_at">>): Promise<void> {
  const { error } = await adminDb().from("payments").update(patch).eq("id", id);
  if (error) throw new DataError("Could not update the refund.", error.code);
}

/** Marks the payment refunded and, if the workspace is still on that plan, moves it back to Free. */
export async function applyRefund(id: string, refundTrxId: string): Promise<boolean> {
  const { data, error } = await adminDb().rpc("apply_refund", { p_payment_id: id, p_refund_trx: refundTrxId });
  if (error) throw new DataError("Could not apply the refund.", error.code);
  return data === true;
}

export async function listRefundRequests(): Promise<PaymentRow[]> {
  const res = await adminDb().from("payments").select(COLUMNS).eq("refund_status", "requested").order("refund_requested_at", { ascending: true }).limit(50);
  return ((unwrap(res, "load the refund requests") ?? []) as PaymentRow[]).map(normalize);
}

/** The workspace created for a new account (the sign-up trigger makes it). */
export async function getPersonalWorkspaceId(userId: string): Promise<string | null> {
  const { data } = await adminDb().from("workspace_members").select("workspace_id").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();
  return (data as { workspace_id: string } | null)?.workspace_id ?? null;
}
