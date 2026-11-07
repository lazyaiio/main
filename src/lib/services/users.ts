import "server-only";
import { listPlans } from "@/lib/data/plans";
import { adminDb } from "@/lib/data/platform";
import { isPlatformAdminUser, removeSuspension, saveSuspension, setSignInBlocked, setWorkspacePlanDirect } from "@/lib/data/users";
import { logError, logInfo } from "@/lib/log";
import { buildPlanChange, cleanReason, isUuid } from "@/lib/users";
import { ServiceError } from "./errors";

export async function changeUserPlan(input: { workspaceId: string; plan: string; period: string; endsOn: string }): Promise<void> {
  if (!isUuid(input.workspaceId)) throw new ServiceError("not_found", "Unknown workspace.");
  const plans = await listPlans(adminDb());
  const change = buildPlanChange({ plan: input.plan, knownPlans: plans.map((p) => p.key), period: input.period, endsOn: input.endsOn });
  if (!change.ok) throw new ServiceError("failed", change.message);
  await setWorkspacePlanDirect(input.workspaceId, change);
  logInfo("admin.plan_changed", { workspace: input.workspaceId, plan: change.plan, period: change.period });
}

/** Suspends a person: the database stops them from creating or changing anything, and Supabase refuses new sign-ins. */
export async function suspendUser(adminUserId: string, userId: string, reason: string): Promise<{ signInBlocked: boolean }> {
  if (!isUuid(userId)) throw new ServiceError("not_found", "Unknown person.");
  if (userId === adminUserId) throw new ServiceError("forbidden", "You cannot suspend your own account.");
  if (await isPlatformAdminUser(userId)) throw new ServiceError("forbidden", "Platform admins cannot be suspended here.");
  await saveSuspension(userId, adminUserId, cleanReason(reason));
  const signInBlocked = await setSignInBlocked(userId, true);
  if (!signInBlocked) logError("users.ban_failed", { user: userId });
  logInfo("admin.user_suspended", { admin: adminUserId, user: userId });
  return { signInBlocked };
}

/** Lifts the suspension. Supabase's sign-in block is lifted first; if that fails nothing changes, so Restore can be pressed again. */
export async function restoreUser(adminUserId: string, userId: string): Promise<void> {
  if (!isUuid(userId)) throw new ServiceError("not_found", "Unknown person.");
  if (!(await setSignInBlocked(userId, false))) {
    logError("users.unban_failed", { user: userId });
    throw new ServiceError("failed", "Could not lift the sign-in block. Nothing was changed. Please try again.");
  }
  await removeSuspension(userId);
  logInfo("admin.user_restored", { admin: adminUserId, user: userId });
}
