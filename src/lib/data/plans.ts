import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Db } from "./db";
import { DataError, unwrap } from "./db";
import { LIMIT_KEYS, parseNumberMap, type Limits, type Usage } from "@/lib/plans";

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

export type PlanRow = { key: string; name: string; limits: Record<string, number> };

export async function listPlans(db: Db): Promise<PlanRow[]> {
  const res = await db.from("plans").select("key, name, limits").order("key", { ascending: true });
  return (unwrap(res, "load the plans") ?? []) as PlanRow[];
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
