import "server-only";
import { adminDb } from "./platform";
import { DataError, type Db } from "./db";
import { USERS_PER_PAGE } from "@/lib/users";

/** Admin user management. Every function uses the service key, so callers must be platform admins. */

export type AdminUserRow = {
  user_id: string;
  email: string;
  display_name: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_verified: boolean;
  suspended: boolean;
  workspace_id: string | null;
  workspace_name: string | null;
  plan: string | null;
  plan_period: string | null;
  plan_expires_at: string | null;
};

type RpcRow = {
  out_user_id: string; out_email: string; out_display_name: string; out_created_at: string; out_last_sign_in_at: string | null;
  out_email_verified: boolean; out_suspended: boolean; out_workspace_id: string | null; out_workspace_name: string | null;
  out_plan: string | null; out_plan_period: string | null; out_plan_expires_at: string | null; out_total: number | string;
};

export async function listAdminUsers(search: string, page: number): Promise<{ users: AdminUserRow[]; total: number }> {
  const { data, error } = await adminDb().rpc("admin_list_users", { p_search: search || null, p_limit: USERS_PER_PAGE, p_offset: (page - 1) * USERS_PER_PAGE });
  if (error) throw new DataError("Could not load the people list. Check that migration 0024 was run.", error.code);
  const rows = (data ?? []) as RpcRow[];
  return {
    total: Number(rows[0]?.out_total ?? 0),
    users: rows.map((r) => ({
      user_id: r.out_user_id, email: r.out_email ?? "", display_name: r.out_display_name ?? "", created_at: r.out_created_at, last_sign_in_at: r.out_last_sign_in_at,
      email_verified: r.out_email_verified, suspended: r.out_suspended, workspace_id: r.out_workspace_id, workspace_name: r.out_workspace_name,
      plan: r.out_plan, plan_period: r.out_plan_period, plan_expires_at: r.out_plan_expires_at,
    })),
  };
}

export async function isPlatformAdminUser(userId: string): Promise<boolean> {
  const { data } = await adminDb().from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

export async function saveSuspension(userId: string, byUserId: string, reason: string): Promise<void> {
  const { error } = await adminDb().from("account_suspensions").upsert({ user_id: userId, reason, suspended_by: byUserId, suspended_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new DataError("Could not suspend the account. Check that migration 0024 was run.", error.code);
}

export async function removeSuspension(userId: string): Promise<void> {
  const { error } = await adminDb().from("account_suspensions").delete().eq("user_id", userId);
  if (error) throw new DataError("Could not restore the account.", error.code);
}

/** Blocks or allows signing in at Supabase itself. Returns false when Supabase refused (the database block still applies). */
export async function setSignInBlocked(userId: string, blocked: boolean): Promise<boolean> {
  try {
    const { error } = await adminDb().auth.admin.updateUserById(userId, { ban_duration: blocked ? "876000h" : "none" });
    return !error;
  } catch {
    return false;
  }
}

export async function setWorkspacePlanDirect(workspaceId: string, change: { plan: string; period: string | null; expiresAt: string | null }): Promise<void> {
  const { data, error } = await adminDb()
    .from("workspaces")
    .update({ plan: change.plan, plan_period: change.period, plan_expires_at: change.expiresAt })
    .eq("id", workspaceId)
    .select("id");
  if (error) throw new DataError("Could not change the plan.", error.code);
  if (!data || data.length === 0) throw new DataError("That workspace could not be found.");
}

/** Whether the signed-in person is suspended (read with their own session; the table may not exist before migration 0024). */
export async function isSuspendedSelf(db: Db, userId: string): Promise<boolean> {
  const { data, error } = await db.from("account_suspensions").select("user_id").eq("user_id", userId).maybeSingle();
  return !error && Boolean(data);
}
