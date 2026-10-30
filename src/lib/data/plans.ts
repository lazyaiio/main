import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Db } from "./db";
import { DataError, unwrap } from "./db";
import { LIMIT_KEYS, parseNumberMap, type Limits, type Usage } from "@/lib/plans";
import { DEFAULT_CURRENCY, isCurrency, type Currency } from "@/lib/pricing";

export const PG_LIMIT_REACHED = "53400";

function admin(): Db {
  return createAdminClient() as unknown as SupabaseClient;
}

export async function getWorkspaceLimits(db: Db, ws: string): Promise<{ plan: string; limits: Limits }> {
  const { data, error } = await db.rpc("workspace_limits", { p_workspace_id: ws });
  if (error || !data) throw new DataError("Could not load the plan.", error?.code);
  const body = data as { plan?: string; limits?: unknown };
  const parsed = parseNumberMap(body.limits);
  const limits = Object.fromEntries(LIMIT_KEYS.map((key) => [key, parsed[key] ?? null])) as Limits;
  return { plan: body.plan ?? "free", limits };
}

export async function getWorkspaceUsage(db: Db, ws: string): Promise<Usage> {
  const { data, error } = await db.rpc("workspace_usage", { p_workspace_id: ws });
  if (error || !data) throw new DataError("Could not load the usage.", error?.code);
  const parsed = parseNumberMap(data);
  return Object.fromEntries(LIMIT_KEYS.map((key) => [key, parsed[key] ?? 0])) as Usage;
}

export type PlanRow = {
  key: string;
  name: string;
  limits: Record<string, number>;
  tagline: string;
  price_monthly: number | null;
  price_yearly: number | null;
  features: string[];
  highlighted: boolean;
  visible: boolean;
  sort_order: number;
};

export async function listPlans(db: Db): Promise<PlanRow[]> {
  const res = await db
    .from("plans")
    .select("key, name, limits, tagline, price_monthly, price_yearly, features, highlighted, visible, sort_order")
    .order("sort_order", { ascending: true });
  return ((unwrap(res, "load the plans") ?? []) as PlanRow[]).map(normalizePlan);
}

function normalizePlan(row: PlanRow): PlanRow {
  return {
    ...row,
    price_monthly: row.price_monthly === null ? null : Number(row.price_monthly),
    price_yearly: row.price_yearly === null ? null : Number(row.price_yearly),
    features: Array.isArray(row.features) ? row.features.filter((f): f is string => typeof f === "string") : [],
  };
}

/** Plans shown to the public (visitors are not signed in, so the server's service key reads them). */
export async function listVisiblePlans(): Promise<PlanRow[]> {
  const res = await admin()
    .from("plans")
    .select("key, name, limits, tagline, price_monthly, price_yearly, features, highlighted, visible, sort_order")
    .eq("visible", true)
    .order("sort_order", { ascending: true });
  return ((unwrap(res, "load the plans") ?? []) as PlanRow[]).map(normalizePlan);
}

export type PlanEdit = {
  key: string;
  name: string;
  tagline: string;
  priceMonthly: number | null;
  priceYearly: number | null;
  features: string[];
  highlighted: boolean;
  visible: boolean;
  limits: Record<string, number>;
};

/** Platform admins only (the caller checks). */
export async function updatePlanDetails(edit: PlanEdit): Promise<void> {
  const { error } = await admin()
    .from("plans")
    .update({
      name: edit.name,
      tagline: edit.tagline,
      price_monthly: edit.priceMonthly,
      price_yearly: edit.priceYearly,
      features: edit.features,
      highlighted: edit.highlighted,
      visible: edit.visible,
      limits: edit.limits,
      updated_at: new Date().toISOString(),
    })
    .eq("key", edit.key);
  if (error) throw new DataError("Could not save the plan.", error.code);
}

const BILLING_KEY = "billing";

export async function getBillingCurrency(): Promise<Currency> {
  try {
    const { data } = await admin().from("platform_settings").select("value").eq("key", BILLING_KEY).maybeSingle();
    const value = (data as { value?: { currency?: unknown } } | null)?.value?.currency;
    return isCurrency(value) ? value : DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

export async function setBillingCurrency(currency: Currency, userId: string): Promise<void> {
  const { error } = await admin()
    .from("platform_settings")
    .upsert({ key: BILLING_KEY, value: { currency }, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: "key" });
  if (error) throw new DataError("Could not save the currency.", error.code);
}

export async function setWorkspacePlan(db: Db, ws: string, plan: string, overrides: Record<string, number>): Promise<void> {
  const { error } = await db.rpc("set_workspace_plan", { p_workspace_id: ws, p_plan: plan, p_overrides: overrides });
  if (error) throw new DataError("Could not change the plan.", error.code);
}

export type AdminWorkspaceRow = { id: string; name: string; plan: string; limit_overrides: Record<string, number>; created_at: string };

/** Platform admins only (the caller checks). Uses the service role because members can only see their own workspace. */
export async function listWorkspacesForAdmin(): Promise<AdminWorkspaceRow[]> {
  const res = await admin().from("workspaces").select("id, name, plan, limit_overrides, created_at").order("created_at", { ascending: false }).limit(200);
  return (unwrap(res, "load the workspaces") ?? []) as AdminWorkspaceRow[];
}

/** One attempt for the signed-in person. Returns false when they are over the limit. Infrastructure errors do not block people. */
export async function rateLimitHit(db: Db, action: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await db.rpc("rate_limit_hit", { p_action: action, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) return true;
  return data === true;
}
