import "server-only";
import type { AppContext } from "@/lib/auth/session";
import { exportFileName, shapeExport } from "@/lib/account-export";
import { deleteAuthUser, listOwnedWorkspaceIds, ownedWorkspacesWithOtherMembers, purgeWorkspaceFiles } from "@/lib/data/account";
import { getDb } from "@/lib/data/db";
import { collectExport } from "@/lib/data/export";
import { describeError, logError } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { ServiceError } from "./errors";
import { enforceRate } from "./plans";

/** "Download my data": 5 times a day at most, using the person's own access. */
export async function buildAccountExport(ctx: AppContext): Promise<{ filename: string; json: string }> {
  const db = await getDb();
  await enforceRate(db, "account_export", 5, 86400);
  const parts = await collectExport(db, ctx.user.id);
  const now = new Date();
  const shaped = shapeExport(parts, { generatedAt: now.toISOString() });
  return { filename: exportFileName(now), json: JSON.stringify(shaped, null, 2) };
}

/**
 * Deletes the signed-in person's account for good.
 *  1. asks for the password again (a stolen session alone is not enough),
 *  2. refuses while a workspace they own still has other members,
 *  3. removes the image files stored for their workspaces,
 *  4. deletes the sign-in account: the database then removes their workspaces and everything in them
 *     (posts, campaigns, schedules, Facebook connections and the stored access tokens, usage, activity),
 *  5. leaves content in other people's workspaces in place with the author cleared.
 */
export async function deleteAccount(ctx: AppContext, input: { password: string }): Promise<void> {
  const db = await getDb();
  await enforceRate(db, "account_delete", 5, 3600);

  const email = ctx.user.email;
  if (!email) throw new ServiceError("failed", "Something went wrong. Please try again.");
  const supabase = await createClient();
  const { error: passwordError } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (passwordError) throw new ServiceError("account_password", "The password is not correct.");

  try {
    if ((await ownedWorkspacesWithOtherMembers(db, ctx.user.id)).length > 0) {
      throw new ServiceError("account_has_members", "Your workspace has other members. Remove them first, or contact us, before deleting the account.");
    }
    const owned = await listOwnedWorkspaceIds(db, ctx.user.id);
    for (const ws of owned) await purgeWorkspaceFiles(ws);
    await deleteAuthUser(ctx.user.id);
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    logError("account.delete_failed", describeError(error));
    throw new ServiceError("failed", "We could not finish deleting your account. Nothing was lost; please try again or contact us.");
  }
}
