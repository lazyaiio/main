import "server-only";
import { canWrite } from "@/lib/auth/permissions";
import type { AppContext } from "@/lib/auth/session";
import { decryptToken } from "@/lib/crypto/token-crypto";
import { getDb } from "@/lib/data/db";
import { getSnapshot, listPublishedPosts, listSnapshotTimes, saveSnapshot, type StoredSnapshot } from "@/lib/data/insights";
import { getSocialPage, getTokenCiphertext, listSocialAccounts, listSocialPages, setPageState } from "@/lib/data/social";
import {
  MAX_POSTS_SHOWN,
  PAGE_METRICS,
  POST_METRICS,
  canRefresh,
  fillDays,
  insightsAccess,
  insightsWindow,
  summarize,
  type InsightsAccess,
  type InsightsSnapshot,
  type MetricProblem,
  type RangeDays,
} from "@/lib/insights";
import { getSocialProvider, getTokenEncryptionKey, isInsightsRequested } from "@/lib/social/keys";
import { SocialError } from "@/lib/social/provider";
import { logAudit } from "./audit";
import { ServiceError } from "./errors";
import { enforceRate } from "./plans";

export type InsightsPage = { id: string; name: string; access: InsightsAccess; fetchedAt: string | null };

/** Which Pages can show Insights and what state each is in. Any member of the workspace may look. */
export async function getInsightsOverview(ctx: AppContext): Promise<{ featureOn: boolean; pages: InsightsPage[] }> {
  const db = await getDb();
  const featureOn = isInsightsRequested();
  const [pages, accounts, times] = await Promise.all([listSocialPages(db, ctx.workspace.id), listSocialAccounts(db, ctx.workspace.id), listSnapshotTimes(db, ctx.workspace.id)]);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  return {
    featureOn,
    pages: pages
      .filter((p) => p.status !== "disconnected")
      .map((p) => {
        const account = accountById.get(p.social_account_id);
        const connected = p.status === "connected" && account?.status === "connected";
        const newest = times.filter((t) => t.social_page_id === p.id).map((t) => t.fetched_at).sort().pop() ?? null;
        return { id: p.id, name: p.name, access: insightsAccess({ featureOn, pageConnected: connected, grantedScopes: account?.granted_scopes ?? [] }), fetchedAt: newest };
      }),
  };
}

export async function getInsightsFor(ctx: AppContext, pageId: string, range: RangeDays): Promise<StoredSnapshot | null> {
  const db = await getDb();
  const page = await getSocialPage(db, ctx.workspace.id, pageId);
  if (!page) throw new ServiceError("not_found", "That Page could not be found.");
  return getSnapshot(db, ctx.workspace.id, pageId, range);
}

const accessMessage = (a: InsightsAccess): string => {
  switch (a.state) {
    case "not_enabled":
      return "Insights are not switched on for this site yet.";
    case "needs_reconnect":
      return "Facebook has not allowed LazyAI to read Insights for this connection. Reconnect Facebook and allow every permission shown.";
    case "page_not_connected":
      return "This Page is not connected right now. Reconnect it first.";
    default:
      return "";
  }
};

export type RefreshResult = { refreshed: boolean; reason: "refreshed" | "recent" };

/**
 * Fetches the Page's numbers from Facebook and saves them (one saved copy per Page and range).
 * Facebook updates most numbers about once a day, so a refresh within half an hour just shows what is saved.
 */
export async function refreshInsights(ctx: AppContext, pageId: string, range: RangeDays): Promise<RefreshResult> {
  if (!canWrite(ctx.role)) throw new ServiceError("forbidden", "Only owners, admins, and editors can refresh Insights.");
  const db = await getDb();
  const ws = ctx.workspace.id;
  const page = await getSocialPage(db, ws, pageId);
  if (!page) throw new ServiceError("not_found", "That Page could not be found.");
  const accounts = await listSocialAccounts(db, ws);
  const account = accounts.find((a) => a.id === page.social_account_id);
  const access = insightsAccess({ featureOn: isInsightsRequested(), pageConnected: page.status === "connected" && account?.status === "connected", grantedScopes: account?.granted_scopes ?? [] });
  if (access.state !== "ready") throw new ServiceError("insights_unavailable", accessMessage(access));

  const existing = await getSnapshot(db, ws, pageId, range);
  if (existing && !canRefresh(existing.fetchedAt)) return { refreshed: false, reason: "recent" };

  const provider = getSocialProvider();
  const key = getTokenEncryptionKey();
  if (!provider || !key) throw new ServiceError("social_not_configured", "Facebook connection is not set up yet.");
  await enforceRate(db, "insights_refresh", 12, 3600); // each refresh is several calls to Facebook

  const cipher = await getTokenCiphertext(ws, page.id);
  if (!cipher) {
    await setPageState(ws, page.id, { status: "error", errorCode: "token_missing" });
    throw new ServiceError("social_token_expired", "Facebook says this connection has expired or was removed. Reconnect the Page to continue.");
  }
  let token: string;
  try {
    token = decryptToken(key, `page:${ws}:${page.provider_page_id}`, cipher);
  } catch {
    throw new ServiceError("failed", "The saved Facebook connection could not be read. Reconnect the Page to continue.");
  }
  const target = { id: page.provider_page_id, accessToken: token };
  const w = insightsWindow(range);

  try {
    const summary = await provider.getPageSummary(target);

    let stopped: MetricProblem | null = null;
    const metrics: InsightsSnapshot["metrics"] = [];
    for (const m of PAGE_METRICS) {
      if (stopped) {
        metrics.push({ key: m.key, total: null, previousTotal: null, changePct: null, points: [], problem: stopped });
        continue;
      }
      const result = await provider.getPageMetric(target, m.graph, w.since, w.until);
      if (result.problem === "rate_limited") stopped = "rate_limited";
      if (result.problem !== null) {
        metrics.push({ key: m.key, total: null, previousTotal: null, changePct: null, points: [], problem: result.problem });
        continue;
      }
      const s = summarize(result.points, range);
      metrics.push({ key: m.key, total: s.total, previousTotal: s.previousTotal, changePct: s.changePct, points: fillDays(s.points, w.currentFrom, w.currentTo), problem: null });
    }

    const posts: InsightsSnapshot["posts"] = [];
    for (const post of await listPublishedPosts(ws, page.id, MAX_POSTS_SHOWN)) {
      const base = { scheduledPostId: post.id, title: post.title, publishedAt: post.published_at };
      if (stopped) {
        posts.push({ ...base, views: null, viewers: null, clicks: null, reactions: null, problem: stopped });
        continue;
      }
      let result;
      try {
        result = await provider.getPostMetrics(target, post.provider_post_id, POST_METRICS.map((m) => m.graph));
      } catch (error) {
        if (error instanceof SocialError && error.kind === "token_expired") throw error;
        result = { values: {} as Record<string, number>, problem: "unavailable" as MetricProblem };
      }
      if (result.problem === "rate_limited") stopped = "rate_limited";
      const pick = (graph: string) => (typeof result.values[graph] === "number" ? result.values[graph]! : null);
      posts.push({ ...base, views: pick("post_media_view"), viewers: pick("post_total_media_view_unique"), clicks: pick("post_clicks"), reactions: pick("post_reactions_by_type_total"), problem: result.problem });
    }

    const snapshot: InsightsSnapshot = { rangeDays: range, currentFrom: w.currentFrom, currentTo: w.currentTo, page: summary, metrics, posts };
    await saveSnapshot(ws, page.id, snapshot);
    await logAudit(db, ctx, "insights.refreshed", "social_page", page.id, { range });
    return { refreshed: true, reason: "refreshed" };
  } catch (error) {
    if (error instanceof SocialError && error.kind === "token_expired") {
      await setPageState(ws, page.id, { status: "error", errorCode: "token_expired" });
      throw new ServiceError("social_token_expired", "Facebook says this connection has expired or was removed. Reconnect the Page to continue.");
    }
    throw error;
  }
}
