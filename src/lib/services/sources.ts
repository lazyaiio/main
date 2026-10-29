import "server-only";
import { canWrite } from "@/lib/auth/permissions";
import type { AppContext } from "@/lib/auth/session";
import { hashContent } from "@/lib/content";
import { getDb, type Db } from "@/lib/data/db";
import { countSourceAttempts, findRecentReadySource, getSourceDocument, recordSourceDocument, type SourceDocRow } from "@/lib/data/sources";
import { getPublicEnv } from "@/lib/env";
import { ExtractError } from "@/lib/extract/errors";
import { nodeResolve, nodeTransport } from "@/lib/extract/node-transport";
import { readArticle } from "@/lib/extract/read-article";
import { parseUserUrl } from "@/lib/extract/url-safety";
import { logAudit } from "./audit";
import { ServiceError } from "./errors";

/** Article text prepared for the AI. */
export type SourceMaterial = {
  documentId: string;
  /** The address to show readers: the page's canonical address when it has one. */
  url: string;
  title: string | null;
  siteName: string | null;
  text: string;
};

const STORED_TEXT_CHARS = 20_000;
const HOUR_MS = 60 * 60 * 1000;

function limit(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 500 ? parsed : fallback;
}

function toMaterial(row: SourceDocRow): SourceMaterial | null {
  if (row.status !== "ready" || !row.extracted_text) return null;
  return {
    documentId: row.id,
    url: row.canonical_url ?? row.source_url,
    title: row.title,
    siteName: row.site_name,
    text: row.extracted_text,
  };
}

/**
 * Reads one article for a post. Safe by construction: only public web pages, robots.txt honored,
 * size/time limits, per-user and per-website request limits, and every attempt is recorded.
 */
export async function readSource(ctx: AppContext, projectId: string | null, rawUrl: string): Promise<SourceMaterial> {
  if (!canWrite(ctx.role)) throw new ServiceError("forbidden", "You do not have permission to do that.");

  let url: URL;
  try {
    url = parseUserUrl(rawUrl);
  } catch (error) {
    if (error instanceof ExtractError) throw new ServiceError("source_failed", error.message);
    throw error;
  }

  const db = await getDb();
  const ws = ctx.workspace.id;
  const since = new Date(Date.now() - HOUR_MS).toISOString();

  // Same page read within the last hour: reuse it instead of fetching again.
  const cached = await findRecentReadySource(db, ws, url.href, since);
  const reused = cached ? toMaterial(cached) : null;
  if (reused) return reused;

  const perUser = limit(process.env.URL_EXTRACTIONS_PER_HOUR, 20);
  const perHost = limit(process.env.URL_EXTRACTIONS_PER_HOST_PER_HOUR, 5);
  if ((await countSourceAttempts(db, ws, { userId: ctx.user.id }, since)) >= perUser) {
    throw new ServiceError("rate_limited", "You have read a lot of web pages in the last hour. Please try again later.");
  }
  if ((await countSourceAttempts(db, ws, { host: url.hostname }, since)) >= perHost) {
    throw new ServiceError("rate_limited", "Too many recent requests to that website. Please try again later.");
  }

  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  let article;
  try {
    article = await readArticle(url.href, {
      transport: nodeTransport,
      resolve: nodeResolve,
      userAgent: `LazyAIBot/1.0 (+${appUrl})`,
      agentToken: "lazyaibot",
    });
  } catch (error) {
    if (!(error instanceof ExtractError)) throw error;
    try {
      await recordSourceDocument(db, {
        workspaceId: ws,
        projectId,
        sourceUrl: url.href,
        canonicalUrl: null,
        host: url.hostname,
        title: null,
        siteName: null,
        text: null,
        status: "failed",
        errorCode: error.kind,
        hash: null,
        metadata: {},
      });
    } catch {
      // Recording the failure is best-effort.
    }
    throw new ServiceError("source_failed", error.message);
  }

  const text = article.text.slice(0, STORED_TEXT_CHARS);
  const id = await recordSourceDocument(db, {
    workspaceId: ws,
    projectId,
    sourceUrl: url.href,
    canonicalUrl: article.canonicalUrl,
    host: article.host,
    title: article.title,
    siteName: article.siteName,
    text,
    status: "ready",
    errorCode: null,
    hash: hashContent(text),
    metadata: { word_count: article.wordCount, language: article.language, redirected: article.finalUrl !== url.href },
  });
  await logAudit(db, ctx, "source.read", "source_document", id, { host: article.host });

  return {
    documentId: id,
    url: article.canonicalUrl ?? article.finalUrl,
    title: article.title,
    siteName: article.siteName,
    text,
  };
}

/** A previously read article (used when regenerating a post). */
export async function loadSourceMaterial(ctx: AppContext, documentId: string): Promise<SourceMaterial | null> {
  const row = await getSourceDocument(await getDb(), ctx.workspace.id, documentId);
  return row ? toMaterial(row) : null;
}

/** Same as loadSourceMaterial, for the background writer (no signed-in person; the workspace comes from the campaign). */
export async function loadSourceMaterialForWorkspace(db: Db, workspaceId: string, documentId: string): Promise<SourceMaterial | null> {
  const row = await getSourceDocument(db, workspaceId, documentId);
  return row ? toMaterial(row) : null;
}
