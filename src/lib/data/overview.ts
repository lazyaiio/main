import "server-only";
import type { Db } from "./db";
import { unwrap } from "./db";
import type { ApprovalStatus, AuditEventRow, CampaignRow, ContentItemRow, ScheduledPostRow } from "./types";

async function countRows(
  db: Db,
  table: string,
  workspaceId: string,
  filter?: { column: string; values: string[] },
): Promise<number> {
  let query = db.from(table).select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
  if (filter) {
    query = filter.values.length === 1 ? query.eq(filter.column, filter.values[0]!) : query.in(filter.column, filter.values);
  }
  const { count, error } = await query;
  if (error) throw new Error("Could not load your numbers.");
  return count ?? 0;
}

export type DashboardStats = {
  projects: number;
  pagesConnected: number;
  contentTotal: number;
  drafts: number;
  awaitingReview: number;
  approved: number;
  scheduled: number;
  published: number;
  failed: number;
};

export async function getDashboardStats(db: Db, ws: string): Promise<DashboardStats> {
  const [projects, pagesConnected, contentTotal, drafts, awaitingReview, approved, scheduled, published, failed] =
    await Promise.all([
      countRows(db, "content_projects", ws, { column: "status", values: ["active"] }),
      countRows(db, "social_pages", ws, { column: "status", values: ["connected"] }),
      countRows(db, "content_items", ws),
      countRows(db, "content_items", ws, { column: "approval_status", values: ["draft"] }),
      countRows(db, "content_items", ws, { column: "approval_status", values: ["awaiting_approval"] }),
      countRows(db, "content_items", ws, { column: "approval_status", values: ["approved"] }),
      countRows(db, "scheduled_posts", ws, { column: "status", values: ["scheduled", "publishing", "retrying"] }),
      countRows(db, "scheduled_posts", ws, { column: "status", values: ["published"] }),
      countRows(db, "scheduled_posts", ws, { column: "status", values: ["failed"] }),
    ]);
  return { projects, pagesConnected, contentTotal, drafts, awaitingReview, approved, scheduled, published, failed };
}

export async function listCampaigns(db: Db, ws: string, limit = 50): Promise<CampaignRow[]> {
  const res = await db
    .from("campaigns")
    .select("*")
    .eq("workspace_id", ws)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (unwrap(res, "load campaigns") ?? []) as CampaignRow[];
}

export const CONTENT_FILTERS: readonly ("all" | ApprovalStatus)[] = [
  "all",
  "draft",
  "awaiting_approval",
  "approved",
  "rejected",
];

export async function listContent(
  db: Db,
  ws: string,
  status: "all" | ApprovalStatus,
  limit = 100,
): Promise<ContentItemRow[]> {
  let query = db
    .from("content_items")
    .select("id, workspace_id, campaign_id, project_id, language, content_format, hook, body, cta, hashtags, approval_status, created_at, updated_at")
    .eq("workspace_id", ws)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status !== "all") query = query.eq("approval_status", status);
  return (unwrap(await query, "load content") ?? []) as ContentItemRow[];
}

export async function listScheduledPostsInRange(
  db: Db,
  ws: string,
  fromIso: string,
  toIso: string,
): Promise<(ScheduledPostRow & { title: string })[]> {
  const res = await db
    .from("scheduled_posts")
    .select("id, workspace_id, content_item_id, social_page_id, scheduled_at, status")
    .eq("workspace_id", ws)
    .gte("scheduled_at", fromIso)
    .lt("scheduled_at", toIso)
    .order("scheduled_at", { ascending: true })
    .limit(500);
  const posts = (unwrap(res, "load the calendar") ?? []) as ScheduledPostRow[];
  if (posts.length === 0) return [];

  const ids = [...new Set(posts.map((p) => p.content_item_id))];
  const items = unwrap(
    await db.from("content_items").select("id, hook, body").eq("workspace_id", ws).in("id", ids),
    "load the calendar",
  ) as { id: string; hook: string | null; body: string }[] | null;
  const titles = new Map((items ?? []).map((i) => [i.id, i.hook?.trim() || i.body.slice(0, 80)]));
  return posts.map((p) => ({ ...p, title: titles.get(p.content_item_id) ?? "Post" }));
}

export async function listAuditEvents(db: Db, ws: string, limit = 50): Promise<AuditEventRow[]> {
  const res = await db
    .from("audit_events")
    .select("id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata, created_at")
    .eq("workspace_id", ws)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (unwrap(res, "load activity") ?? []) as AuditEventRow[];
}
