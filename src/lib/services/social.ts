import "server-only";
import { z } from "zod";
import { canAdmin } from "@/lib/auth/permissions";
import type { AppContext } from "@/lib/auth/session";
import { TokenCryptoError, decryptToken, encryptToken } from "@/lib/crypto/token-crypto";
import { DataError, getDb } from "@/lib/data/db";
import {
  PAGE_IN_USE,
  authorizeFlow,
  closeFlow,
  countConnectedPages,
  createFlow,
  deleteToken,
  getFlow,
  getSocialPage,
  getTokenCiphertext,
  listSocialAccounts,
  listSocialPages,
  purgeExpiredFlows,
  saveToken,
  setAccountStatus,
  setPageState,
  upsertAccount,
  upsertPage,
  type FlowRow,
  type SocialPageRow,
} from "@/lib/data/social";
import {
  FLOW_TTL_MS,
  buildFlowCookie,
  hashNonce,
  isFlowExpired,
  newNonce,
  parseFlowCookie,
  verifyCallbackState,
} from "@/lib/social/flow";
import { getRedirectUri, getSocialProvider, getSocialSetup, getTokenEncryptionKey } from "@/lib/social/keys";
import { SocialError, type SocialErrorKind } from "@/lib/social/provider";
import { logAudit } from "./audit";
import { ServiceError, type ServiceErrorKind } from "./errors";

function requireAdmin(ctx: AppContext) {
  if (!canAdmin(ctx.role)) throw new ServiceError("forbidden", "Only workspace owners and admins can connect or disconnect Facebook Pages.");
}

/** Our own user-facing error for each kind of Facebook problem. */
export function socialErrorKind(kind: SocialErrorKind): ServiceErrorKind {
  switch (kind) {
    case "denied":
      return "social_denied";
    case "token_expired":
      return "social_token_expired";
    case "permission_missing":
      return "social_permission";
    case "page_access_lost":
      return "social_page_lost";
    case "rate_limited":
    case "temporary":
      return "social_busy";
    case "not_configured":
      return "social_not_configured";
    default:
      return "social_failed";
  }
}

function fromSocialError(error: unknown): never {
  if (error instanceof SocialError) throw new ServiceError(socialErrorKind(error.kind), error.message);
  throw error;
}

function secret(): string {
  const key = getTokenEncryptionKey();
  if (!key) throw new ServiceError("social_not_configured", "Facebook connection is not set up yet. An admin needs to finish the Meta app setup.");
  return key;
}

const payloadSchema = z.object({
  user: z.object({ id: z.string(), name: z.string() }),
  scopes: z.array(z.string()),
  tokenExpiresAt: z.string().nullable(),
  pages: z
    .array(
      z.object({
        id: z.string().regex(/^\d{1,25}$/),
        name: z.string(),
        category: z.string().nullable(),
        tasks: z.array(z.string()),
        canPublish: z.boolean(),
        token: z.string().min(10),
      }),
    )
    .max(300),
});
type Payload = z.infer<typeof payloadSchema>;

const flowContext = (flowId: string) => `flow:${flowId}`;
const tokenContext = (workspaceId: string, providerPageId: string) => `page:${workspaceId}:${providerPageId}`;

// ---------------------------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------------------------

export type PageView = SocialPageRow & { accountName: string | null; canPublish: boolean };

export async function getPagesOverview(ctx: AppContext) {
  const db = await getDb();
  const [pages, accounts] = await Promise.all([listSocialPages(db, ctx.workspace.id), listSocialAccounts(db, ctx.workspace.id)]);
  const names = new Map(accounts.map((a) => [a.id, a.display_name]));
  const views: PageView[] = pages.map((page) => ({
    ...page,
    accountName: names.get(page.social_account_id) ?? null,
    canPublish: page.capabilities.can_publish === true,
  }));
  return { setup: getSocialSetup(), pages: views };
}

// ---------------------------------------------------------------------------------------------
// Connect
// ---------------------------------------------------------------------------------------------

/** Starts a connection attempt. The caller sets the cookie and sends the browser to authorizeUrl. */
export async function startConnection(ctx: AppContext): Promise<{ authorizeUrl: string; cookieValue: string }> {
  requireAdmin(ctx);
  const setup = getSocialSetup();
  const provider = getSocialProvider();
  if (!setup.ready || !provider) {
    throw new ServiceError("social_not_configured", "Facebook connection is not set up yet. An admin needs to finish the Meta app setup (see docs/META_SETUP.md).");
  }
  secret(); // fail early, before sending anyone to Facebook

  try {
    await purgeExpiredFlows();
  } catch {
    // Housekeeping only.
  }

  const nonce = newNonce();
  let flowId: string;
  try {
    flowId = await createFlow({
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      stateHash: hashNonce(nonce),
      expiresAt: new Date(Date.now() + FLOW_TTL_MS),
    });
  } catch {
    throw new ServiceError("failed", "Something went wrong. Please try again.");
  }
  const db = await getDb();
  await logAudit(db, ctx, "social.connect_started", "social_flow", flowId, { mode: provider.id });
  return {
    authorizeUrl: provider.buildAuthorizationUrl({ state: nonce, redirectUri: getRedirectUri() }),
    cookieValue: buildFlowCookie(flowId, nonce),
  };
}

function assertFlowUsable(ctx: AppContext, flow: FlowRow | null, expected: "started" | "authorized"): FlowRow {
  const bad = () => new ServiceError("social_attempt_expired", "That connection attempt expired or was already used. Start again with Connect Facebook.");
  if (!flow) throw bad();
  if (flow.workspace_id !== ctx.workspace.id || flow.user_id !== ctx.user.id) throw bad();
  if (flow.status !== expected || isFlowExpired(flow.expires_at)) throw bad();
  return flow;
}

/**
 * Facebook sent the person back. Checks the attempt, trades the code for tokens, confirms the
 * permissions, reads the Pages, and keeps them (encrypted) until the person picks which to connect.
 * Returns the attempt id for the selection screen.
 */
export async function completeCallback(
  ctx: AppContext,
  input: { code?: string | null; state?: string | null; cookieValue?: string | null; providerError?: string | null },
): Promise<string> {
  requireAdmin(ctx);
  const cookie = parseFlowCookie(input.cookieValue);

  if (input.providerError) {
    if (cookie) await closeFlow(cookie.flowId, "failed").catch(() => undefined);
    throw new ServiceError("social_denied", "The connection was canceled, or Facebook permissions were not granted. Try again and allow every permission shown.");
  }
  if (!cookie || !input.code || !input.state || input.code.length > 2000 || input.state.length > 200) {
    throw new ServiceError("social_attempt_expired", "That connection attempt expired or was already used. Start again with Connect Facebook.");
  }

  const flow = assertFlowUsable(ctx, await getFlow(cookie.flowId), "started");
  if (!verifyCallbackState({ urlState: input.state, cookieNonce: cookie.nonce, storedHash: flow.state_hash })) {
    throw new ServiceError("social_attempt_expired", "That connection attempt expired or was already used. Start again with Connect Facebook.");
  }

  const provider = getSocialProvider();
  if (!provider) throw new ServiceError("social_not_configured", "Facebook connection is not set up yet.");
  const key = secret();

  let payload: Payload;
  try {
    const short = await provider.exchangeCode({ code: input.code, redirectUri: getRedirectUri() });
    const long = await provider.extendUserToken(short.accessToken);
    const info = await provider.inspectToken(long.accessToken);
    if (!info.valid) throw new SocialError("denied", "Facebook did not accept the login.");

    // When Facebook reports the granted permissions, every permission LazyAI needs must be there.
    if (info.scopes.length > 0 && provider.requiredScopes.some((scope) => !info.scopes.includes(scope))) {
      await closeFlow(flow.id, "failed");
      throw new ServiceError("social_scopes", "Facebook did not grant every permission LazyAI needs (show Pages, read engagement, and manage posts). Try again and allow all of them.");
    }

    const listed = await provider.listPages(long.accessToken);
    if (listed.pages.length === 0) {
      await closeFlow(flow.id, "failed");
      throw new ServiceError("social_no_pages", "No Pages were found for that Facebook account. You need a role on at least one Page that lets you create posts.");
    }
    payload = {
      user: listed.user,
      scopes: info.scopes,
      tokenExpiresAt: info.expiresAt ? info.expiresAt.toISOString() : null,
      pages: listed.pages.map((p) => ({ id: p.id, name: p.name, category: p.category, tasks: p.tasks, canPublish: p.canPublish, token: p.accessToken })),
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    await closeFlow(flow.id, "failed").catch(() => undefined);
    return fromSocialError(error);
  }

  try {
    await authorizeFlow(flow.id, encryptToken(key, flowContext(flow.id), JSON.stringify(payload)));
  } catch {
    throw new ServiceError("failed", "Something went wrong. Please try again.");
  }
  return flow.id;
}

function readPayload(flow: FlowRow): Payload {
  if (!flow.payload_ciphertext) throw new ServiceError("social_attempt_expired", "That connection attempt expired or was already used. Start again with Connect Facebook.");
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(decryptToken(secret(), flowContext(flow.id), flow.payload_ciphertext)));
    if (!parsed.success) throw new TokenCryptoError("bad payload");
    return parsed.data;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("failed", "Something went wrong. Please start the connection again.");
  }
}

export type PendingSelection = {
  flowId: string;
  accountName: string;
  pages: { id: string; name: string; category: string | null; canPublish: boolean; alreadyConnected: boolean }[];
};

/** What the "choose Pages" screen shows. Never includes tokens. */
export async function getPendingSelection(ctx: AppContext, flowId: string): Promise<PendingSelection> {
  requireAdmin(ctx);
  const flow = assertFlowUsable(ctx, await getFlow(flowId), "authorized");
  const payload = readPayload(flow);
  const db = await getDb();
  const connected = new Set((await listSocialPages(db, ctx.workspace.id)).filter((p) => p.status === "connected").map((p) => p.provider_page_id));
  return {
    flowId: flow.id,
    accountName: payload.user.name,
    pages: payload.pages.map((p) => ({ id: p.id, name: p.name, category: p.category, canPublish: p.canPublish, alreadyConnected: connected.has(p.id) })),
  };
}

/** Saves the chosen Pages and their encrypted tokens. Pages that were not chosen are forgotten. */
export async function connectPages(ctx: AppContext, flowId: string, selectedIds: string[]): Promise<number> {
  requireAdmin(ctx);
  const flow = assertFlowUsable(ctx, await getFlow(flowId), "authorized");
  const payload = readPayload(flow);
  const key = secret();

  const wanted = new Set(selectedIds);
  const chosen = payload.pages.filter((p) => wanted.has(p.id));
  if (chosen.length === 0) throw new ServiceError("invalid", "Choose at least one Page to connect.");
  if (chosen.some((p) => !p.canPublish)) {
    throw new ServiceError("social_permission", "You can only connect Pages where your Facebook account is allowed to create posts.");
  }

  const db = await getDb();
  try {
    const accountId = await upsertAccount({
      workspaceId: ctx.workspace.id,
      providerAccountId: payload.user.id,
      displayName: payload.user.name,
      scopes: payload.scopes,
      tokenExpiresAt: payload.tokenExpiresAt ? new Date(payload.tokenExpiresAt) : null,
    });
    for (const page of chosen) {
      const pageId = await upsertPage({
        workspaceId: ctx.workspace.id,
        accountId,
        providerPageId: page.id,
        name: page.name,
        category: page.category,
        tasks: page.tasks,
        canPublish: page.canPublish,
      });
      await saveToken(ctx.workspace.id, pageId, encryptToken(key, tokenContext(ctx.workspace.id, page.id), page.token));
      await logAudit(db, ctx, "social.page_connected", "social_page", pageId, { provider_page_id: page.id });
    }
  } catch (error) {
    if (error instanceof DataError && error.code === PAGE_IN_USE) {
      throw new ServiceError("social_page_in_use", "One of those Pages is already connected to another LazyAI workspace.");
    }
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("failed", "Something went wrong. Please try again.");
  }
  await closeFlow(flow.id, "completed");
  return chosen.length;
}

// ---------------------------------------------------------------------------------------------
// Check and disconnect
// ---------------------------------------------------------------------------------------------

export type PageCheck = { ok: true; name: string } | { ok: false; kind: SocialErrorKind };

/** Asks Facebook whether the stored Page token still works, and records the answer. */
export async function checkPageConnection(ctx: AppContext, pageId: string): Promise<PageCheck> {
  requireAdmin(ctx);
  const db = await getDb();
  const page = await getSocialPage(db, ctx.workspace.id, pageId);
  if (!page) throw new ServiceError("not_found", "That Page could not be found.");
  if (page.status === "disconnected") throw new ServiceError("invalid", "That Page is disconnected. Connect it again first.");
  const provider = getSocialProvider();
  if (!provider) throw new ServiceError("social_not_configured", "Facebook connection is not set up yet.");

  const cipher = await getTokenCiphertext(ctx.workspace.id, page.id);
  if (!cipher) {
    await setPageState(ctx.workspace.id, page.id, { status: "error", errorCode: "token_missing" });
    return { ok: false, kind: "token_expired" };
  }
  let token: string;
  try {
    token = decryptToken(secret(), tokenContext(ctx.workspace.id, page.provider_page_id), cipher);
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    await setPageState(ctx.workspace.id, page.id, { status: "error", errorCode: "token_unreadable" });
    return { ok: false, kind: "unknown" };
  }

  try {
    const result = await provider.checkPage({ id: page.provider_page_id, accessToken: token });
    await setPageState(ctx.workspace.id, page.id, { status: "connected", validatedAt: new Date(), errorCode: null });
    await logAudit(db, ctx, "social.page_checked", "social_page", page.id, { ok: true });
    return { ok: true, name: result.name };
  } catch (error) {
    if (!(error instanceof SocialError)) throw error;
    await setPageState(ctx.workspace.id, page.id, { status: "error", errorCode: error.kind });
    if (error.kind === "token_expired") await setAccountStatus(ctx.workspace.id, page.social_account_id, "expired", error.kind).catch(() => undefined);
    await logAudit(db, ctx, "social.page_checked", "social_page", page.id, { ok: false, kind: error.kind, code: error.details.code ?? null });
    return { ok: false, kind: error.kind };
  }
}

/** Forgets the Page's token and marks it disconnected. (Facebook's own app list is cleaned by the person.) */
export async function disconnectPage(ctx: AppContext, pageId: string): Promise<void> {
  requireAdmin(ctx);
  const db = await getDb();
  const page = await getSocialPage(db, ctx.workspace.id, pageId);
  if (!page) throw new ServiceError("not_found", "That Page could not be found.");
  try {
    await deleteToken(ctx.workspace.id, page.id);
    await setPageState(ctx.workspace.id, page.id, { status: "disconnected", errorCode: null });
    if ((await countConnectedPages(ctx.workspace.id, page.social_account_id)) === 0) {
      await setAccountStatus(ctx.workspace.id, page.social_account_id, "revoked");
    }
  } catch {
    throw new ServiceError("failed", "Something went wrong. Please try again.");
  }
  await logAudit(db, ctx, "social.page_disconnected", "social_page", page.id, {});
}
