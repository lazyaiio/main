import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Db } from "./db";
import { DataError, unwrap } from "./db";
import { MEDIA_BUCKET } from "./media";

function admin(): Db {
  return createAdminClient() as unknown as SupabaseClient;
}

/** Workspaces this person owns that also have other members (they must be handled before deleting). */
export async function ownedWorkspacesWithOtherMembers(db: Db, userId: string): Promise<string[]> {
  const owned = (unwrap(await db.from("workspaces").select("id").eq("owner_id", userId), "load the workspaces") ?? []) as { id: string }[];
  const crowded: string[] = [];
  for (const ws of owned) {
    const { count, error } = await db.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", ws.id);
    if (error) throw new DataError("Could not check the members.");
    if ((count ?? 0) > 1) crowded.push(ws.id);
  }
  return crowded;
}

export async function listOwnedWorkspaceIds(db: Db, userId: string): Promise<string[]> {
  return ((unwrap(await db.from("workspaces").select("id").eq("owner_id", userId), "load the workspaces") ?? []) as { id: string }[]).map((w) => w.id);
}

/** Deletes every file (images and thumbnails) stored under the workspace's folder. Storage is not removed by database cascades. */
export async function purgeWorkspaceFiles(ws: string): Promise<void> {
  const bucket = admin().storage.from(MEDIA_BUCKET);
  for (let page = 0; page < 50; page++) {
    const { data, error } = await bucket.list(ws, { limit: 100 });
    if (error) throw new DataError("Could not list the files.");
    if (!data || data.length === 0) return;
    const { error: removeError } = await bucket.remove(data.map((file) => `${ws}/${file.name}`));
    if (removeError) throw new DataError("Could not remove the files.");
    if (data.length < 100) return;
  }
}

/** Deletes the sign-in account. Owned workspaces and everything in them are removed by database cascades. */
export async function deleteAuthUser(userId: string): Promise<void> {
  const { error } = await admin().auth.admin.deleteUser(userId);
  if (error) throw new DataError("Could not delete the account.");
}
