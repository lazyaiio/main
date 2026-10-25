import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Db } from "./db";
import { DataError, unwrap } from "./db";

/**
 * Facebook connections.
 *
 * READS use the signed-in user's own session (row security: members of the workspace only).
 * WRITES and everything involving tokens use the service-role client, because browsers have no
 * access to those tables. Every function below takes the workspace id and filters by it; callers
 * must have already checked the person's role.
 */

export const PAGE_IN_USE = "PAGE_IN_USE";

export type SocialAccountRow = {
  id: string;
  workspace_id: string;
  provider: "facebook";
  provider_account_id: string;
  display_name: string | null;
  status: "connected" | "expired" | "revoked" | "error";
  granted_scopes: string[];
  token_expires_at: string | null;
  last_validated_at: string | null;
  last_error_code: string | null;
  created_at: string;
};

export type SocialPageRow = {
  id: string;
  workspace_id: string;
  social_account_id: string;
  provider_page_id: string;
  name: string;
  category: string | null;
  capabilities: { tasks?: string[]; can_publish?: boolean };
  status: "connected" | "disconnected" | "error";
  last_validated_at: string | null;
  last_error_code: string | null;
  created_at: string;
};

export type FlowRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  state_hash: string;
  status: "started" | "authorized" | "completed" | "failed";
  payload_ciphertext: string | null;
  expires_at: string;
};

function admin(): Db {
  return createAdminClient() as unknown as SupabaseClient;
}

const PAGE_COLUMNS = "id, workspace_id, social_account_id, provider_page_id, name, category, capabilities, status, last_validated_at, last_error_code, created_at";
const ACCOUNT_COLUMNS = "id, workspace_id, provider, provider_account_id, display_name, status, granted_scopes, token_expires_at, last_validated_at, last_error_code, created_at";

// ---------- Reads (signed-in user, row security applies) ----------

export async function listSocialPages(db: Db, ws: string): Promise<SocialPageRow[]> {
  const res = await db.from("social_pages").select(PAGE_COLUMNS).eq("workspace_id", ws).order("created_at", { ascending: true }).limit(100);
  return (unwrap(res, "load the Pages") ?? []) as SocialPageRow[];
}

export async function getSocialPage(db: Db, ws: string, id: string): Promise<SocialPageRow | null> {
  const res = await db.from("social_pages").select(PAGE_COLUMNS).eq("workspace_id", ws).eq("id", id).maybeSingle();
  return unwrap(res, "load the Page") as SocialPageRow | null;
}

export async function listSocialAccounts(db: Db, ws: string): Promise<SocialAccountRow[]> {
  const res = await db.from("social_accounts").select(ACCOUNT_COLUMNS).eq("workspace_id", ws).limit(20);
  return (unwrap(res, "load the accounts") ?? []) as SocialAccountRow[];
}

// ---------- Connection attempts (service role) ----------

export async function purgeExpiredFlows(): Promise<void> {
  await admin().from("social_oauth_flows").delete().lt("expires_at", new Date().toISOString());
}

export async function createFlow(args: { workspaceId: string; userId: string; stateHash: string; expiresAt: Date }): Promise<string> {
  const res = await admin()
    .from("social_oauth_flows")
    .insert({ workspace_id: args.workspaceId, user_id: args.userId, state_hash: args.stateHash, expires_at: args.expiresAt.toISOString() })
    .select("id")
    .single();
  const row = unwrap(res, "start the connection") as { id: string } | null;
  if (!row) throw new DataError("Could not start the connection.");
  return row.id;
}

export async function getFlow(id: string): Promise<FlowRow | null> {
  const res = await admin()
    .from("social_oauth_flows")
    .select("id, workspace_id, user_id, state_hash, status, payload_ciphertext, expires_at")
    .eq("id", id)
    .maybeSingle();
  return unwrap(res, "load the connection") as FlowRow | null;
}

export async function authorizeFlow(id: string, payloadCiphertext: string): Promise<void> {
  const res = await admin().from("social_oauth_flows").update({ status: "authorized", payload_ciphertext: payloadCiphertext }).eq("id", id).eq("status", "started").select("id");
  const rows = (unwrap(res, "save the connection") as unknown[] | null) ?? [];
  if (rows.length === 0) throw new DataError("Could not save the connection.");
}

/** Marks an attempt finished and erases the stored Page list (and the tokens in it). */
export async function closeFlow(id: string, status: "completed" | "failed"): Promise<void> {
  await admin().from("social_oauth_flows").update({ status, payload_ciphertext: null }).eq("id", id);
}

// ---------- Accounts, Pages, tokens (service role) ----------

export async function upsertAccount(args: {
  workspaceId: string;
  providerAccountId: string;
  displayName: string;
  scopes: string[];
  tokenExpiresAt: Date | null;
}): Promise<string> {
  const db = admin();
  const found = await db
    .from("social_accounts")
    .select("id")
    .eq("workspace_id", args.workspaceId)
    .eq("provider", "facebook")
    .eq("provider_account_id", args.providerAccountId)
    .maybeSingle();
  const existing = unwrap(found, "find the account") as { id: string } | null;
  const values = {
    display_name: args.displayName.slice(0, 200),
    granted_scopes: args.scopes,
    status: "connected",
    token_expires_at: args.tokenExpiresAt ? args.tokenExpiresAt.toISOString() : null,
    last_validated_at: new Date().toISOString(),
    last_error_code: null,
  };
  if (existing) {
    unwrap(await db.from("social_accounts").update(values).eq("workspace_id", args.workspaceId).eq("id", existing.id), "update the account");
    return existing.id;
  }
  const inserted = await db
    .from("social_accounts")
    .insert({ workspace_id: args.workspaceId, provider: "facebook", provider_account_id: args.providerAccountId, ...values })
    .select("id")
    .single();
  const row = unwrap(inserted, "save the account") as { id: string } | null;
  if (!row) throw new DataError("Could not save the account.");
  return row.id;
}

export async function upsertPage(args: {
  workspaceId: string;
  accountId: string;
  providerPageId: string;
  name: string;
  category: string | null;
  tasks: string[];
  canPublish: boolean;
}): Promise<string> {
  const db = admin();
  const found = await db.from("social_pages").select("id, workspace_id").eq("provider_page_id", args.providerPageId).maybeSingle();
  const existing = unwrap(found, "find the Page") as { id: string; workspace_id: string } | null;
  // A Facebook Page can belong to only one LazyAI workspace.
  if (existing && existing.workspace_id !== args.workspaceId) throw new DataError("Page already connected elsewhere.", PAGE_IN_USE);

  const values = {
    social_account_id: args.accountId,
    name: args.name.slice(0, 200),
    category: args.category ? args.category.slice(0, 200) : null,
    capabilities: { tasks: args.tasks, can_publish: args.canPublish },
    status: "connected",
    last_validated_at: new Date().toISOString(),
    last_error_code: null,
  };
  if (existing) {
    unwrap(await db.from("social_pages").update(values).eq("workspace_id", args.workspaceId).eq("id", existing.id), "update the Page");
    return existing.id;
  }
  const inserted = await db
    .from("social_pages")
    .insert({ workspace_id: args.workspaceId, provider_page_id: args.providerPageId, ...values })
    .select("id")
    .single();
  const row = unwrap(inserted, "save the Page") as { id: string } | null;
  if (!row) throw new DataError("Could not save the Page.");
  return row.id;
}

export async function saveToken(ws: string, pageId: string, ciphertext: string): Promise<void> {
  const res = await admin()
    .from("social_page_tokens")
    .upsert({ social_page_id: pageId, workspace_id: ws, token_ciphertext: ciphertext, key_version: 1 }, { onConflict: "social_page_id" });
  unwrap(res, "store the Page token");
}

export async function getTokenCiphertext(ws: string, pageId: string): Promise<string | null> {
  const res = await admin().from("social_page_tokens").select("token_ciphertext").eq("workspace_id", ws).eq("social_page_id", pageId).maybeSingle();
  const row = unwrap(res, "read the Page token") as { token_ciphertext: string } | null;
  return row?.token_ciphertext ?? null;
}

export async function deleteToken(ws: string, pageId: string): Promise<void> {
  unwrap(await admin().from("social_page_tokens").delete().eq("workspace_id", ws).eq("social_page_id", pageId), "remove the Page token");
}

export async function setPageState(
  ws: string,
  pageId: string,
  state: { status: SocialPageRow["status"]; validatedAt?: Date | null; errorCode?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = { status: state.status, last_error_code: state.errorCode ?? null };
  if (state.validatedAt) patch.last_validated_at = state.validatedAt.toISOString();
  unwrap(await admin().from("social_pages").update(patch).eq("workspace_id", ws).eq("id", pageId), "update the Page");
}

export async function setAccountStatus(ws: string, accountId: string, status: SocialAccountRow["status"], errorCode: string | null = null): Promise<void> {
  unwrap(await admin().from("social_accounts").update({ status, last_error_code: errorCode }).eq("workspace_id", ws).eq("id", accountId), "update the account");
}

export async function countConnectedPages(ws: string, accountId: string): Promise<number> {
  const { count, error } = await admin()
    .from("social_pages")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ws)
    .eq("social_account_id", accountId)
    .eq("status", "connected");
  if (error) throw new DataError("Could not check the Pages.");
  return count ?? 0;
}

// ---------- Data deletion (service role) ----------

export type DeletionSource = "facebook_deletion" | "facebook_deauthorize";

export async function createDeletionRequest(code: string, source: DeletionSource): Promise<void> {
  unwrap(await admin().from("data_deletion_requests").insert({ code, source }), "record the deletion request");
}

export async function finishDeletionRequest(code: string, status: "completed" | "failed", matchedAccounts: number): Promise<void> {
  await admin()
    .from("data_deletion_requests")
    .update({ status, matched_accounts: matchedAccounts, completed_at: new Date().toISOString() })
    .eq("code", code);
}

export async function getDeletionStatus(code: string): Promise<{ status: "received" | "completed" | "failed"; completed_at: string | null } | null> {
  const res = await admin().from("data_deletion_requests").select("status, completed_at").eq("code", code).maybeSingle();
  return unwrap(res, "load the deletion request") as { status: "received" | "completed" | "failed"; completed_at: string | null } | null;
}

/**
 * Removes everything LazyAI holds about one Facebook user: Page tokens are deleted, Pages are disconnected,
 * scheduled posts for those Pages are canceled, and the stored Facebook name and permissions are cleared.
 * Content the person created in LazyAI is not touched here (that is the account deletion workflow).
 */
export async function revokeFacebookUser(providerUserId: string): Promise<{ accounts: number; pages: number }> {
  const db = admin();
  const accounts = (unwrap(
    await db.from("social_accounts").select("id").eq("provider", "facebook").eq("provider_account_id", providerUserId),
    "find the accounts",
  ) ?? []) as { id: string }[];
  if (accounts.length === 0) return { accounts: 0, pages: 0 };
  const accountIds = accounts.map((a) => a.id);

  const pages = (unwrap(await db.from("social_pages").select("id").in("social_account_id", accountIds), "find the Pages") ?? []) as { id: string }[];
  const pageIds = pages.map((p) => p.id);

  if (pageIds.length > 0) {
    unwrap(await db.from("social_page_tokens").delete().in("social_page_id", pageIds), "delete the tokens");
    unwrap(
      await db
        .from("scheduled_posts")
        .update({ status: "cancelled", last_error: "page_disconnected" })
        .in("social_page_id", pageIds)
        .in("status", ["scheduled", "retrying"]),
      "cancel the scheduled posts",
    );
    unwrap(await db.from("social_pages").update({ status: "disconnected", last_error_code: null }).in("id", pageIds), "disconnect the Pages");
  }
  unwrap(
    await db
      .from("social_accounts")
      .update({ status: "revoked", display_name: null, granted_scopes: [], token_expires_at: null, last_error_code: null })
      .in("id", accountIds),
    "clear the accounts",
  );
  return { accounts: accountIds.length, pages: pageIds.length };
}

/** Posts waiting for a Page that is being disconnected are canceled, so nothing is published later by surprise. */
export async function cancelPendingPostsForPage(ws: string, pageId: string): Promise<void> {
  unwrap(
    await admin()
      .from("scheduled_posts")
      .update({ status: "cancelled", last_error: "page_disconnected", next_attempt_at: null })
      .eq("workspace_id", ws)
      .eq("social_page_id", pageId)
      .in("status", ["scheduled", "retrying"]),
    "cancel the scheduled posts",
  );
}
