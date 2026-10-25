import { timingSafeEqual } from "node:crypto";

/**
 * Decision logic for publishing due posts. Everything that touches the database or Facebook is passed
 * in (see services/publisher.ts), so the safety rules can be tested without a network.
 *
 * Rules:
 *  - work only on posts the database handed out (atomic claim), a few at a time,
 *  - stop starting new posts when the time budget is nearly used up and hand the rest back untouched,
 *  - TEMPORARY problems (Facebook refused the request for a reason that will pass) are retried with a
 *    growing delay, up to a limit,
 *  - PERMANENT problems (no permission, expired access, rejected content) fail at once,
 *  - UNCERTAIN results (we cannot tell whether the post was created) are never retried automatically,
 *  - a failure to record a success is retried, never turned into a second publish.
 */

export const MAX_PUBLISH_ATTEMPTS = 5;
const BACKOFF_SECONDS = [60, 300, 900, 3600, 10800] as const;

/** Seconds to wait before attempt number (attempt + 1). attempt is the number already made, starting at 1. */
export function backoffSeconds(attempt: number): number {
  const index = Math.min(Math.max(Math.floor(attempt), 1), BACKOFF_SECONDS.length) - 1;
  return BACKOFF_SECONDS[index] ?? 10800;
}

export type PublishDecision =
  | { action: "retry"; code: string; delaySeconds: number }
  | { action: "fail"; code: string; pageProblem?: string }
  | { action: "uncertain" };

/** Thrown by the publisher for problems found before anything was sent to Facebook. */
export class PrepareError extends Error {
  constructor(
    public readonly code: string,
    public readonly retry: boolean,
  ) {
    super(code);
    this.name = "PrepareError";
  }
}

type SocialLike = { name: string; kind: string; details?: { uncertain?: boolean } };

function isSocialError(error: unknown): error is Error & SocialLike {
  return error instanceof Error && error.name === "SocialError" && typeof (error as unknown as SocialLike).kind === "string";
}

/** What to do after a failed publish attempt. `attempt` is the number of attempts made so far (1 for the first). */
export function decideAfterError(error: unknown, attempt: number): PublishDecision {
  if (error instanceof Error && error.name === "PrepareError") {
    const prepare = error as PrepareError;
    return prepare.retry ? { action: "retry", code: prepare.code, delaySeconds: backoffSeconds(attempt) } : { action: "fail", code: prepare.code };
  }
  if (!isSocialError(error)) return { action: "fail", code: "unexpected" };

  if (error.details?.uncertain) return { action: "uncertain" };
  switch (error.kind) {
    case "rate_limited":
      return { action: "retry", code: "rate_limited", delaySeconds: backoffSeconds(attempt) };
    case "temporary":
      return { action: "retry", code: "temporary", delaySeconds: backoffSeconds(attempt) };
    case "token_expired":
    case "permission_missing":
    case "page_access_lost":
      return { action: "fail", code: error.kind, pageProblem: error.kind };
    case "content_rejected":
      return { action: "fail", code: "content_rejected" };
    case "invalid_request":
      return { action: "fail", code: "invalid_request" };
    default:
      return { action: "fail", code: "unexpected" };
  }
}

/** The text that is posted: the body, the call to action if it is not already in the body, and hashtags. */
export function composePostMessage(item: { body: string; cta: string | null; hashtags: string[] }): string {
  let message = item.body.trim();
  const cta = item.cta?.trim();
  if (cta && !message.includes(cta)) message += `\n\n${cta}`;

  const lower = message.toLowerCase();
  const tags = item.hashtags
    .map((tag) => tag.trim().replace(/\s+/g, ""))
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .filter((tag) => tag.length > 1 && !lower.includes(tag.toLowerCase()));
  if (tags.length > 0) message += `\n\n${Array.from(new Set(tags)).join(" ")}`;
  return message;
}

/** Checks the "Authorization: Bearer <secret>" header of a scheduler request. Fails closed when no secret is set. */
export function isAuthorizedCron(header: string | null | undefined, secret: string | null): boolean {
  if (!secret || !header) return false;
  const match = /^Bearer (.+)$/.exec(header.trim());
  if (!match?.[1]) return false;
  const given = Buffer.from(match[1]);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// ---------------------------------------------------------------------------------------------

export type DuePost = { id: string; attempt: number };

export type DispatchDeps = {
  now: () => number;
  /** False while live publishing is switched off: nothing is claimed or sent. */
  enabled: boolean;
  claim: (limit: number) => Promise<DuePost[]>;
  /** Publishes one post. Resolves with the provider's post id, or throws. */
  publish: (post: DuePost) => Promise<string>;
  finishPublished: (post: DuePost, providerPostId: string) => Promise<boolean>;
  finishRetry: (post: DuePost, code: string, delaySeconds: number) => Promise<void>;
  finishFailed: (post: DuePost, code: string) => Promise<void>;
  release: (post: DuePost) => Promise<void>;
  classify?: (error: unknown, attempt: number) => PublishDecision;
  /** Called when a Page problem (expired access, lost role) should be shown on the Page. */
  onPageProblem?: (post: DuePost, problem: string) => Promise<void>;
};

export type DispatchOptions = { maxPosts: number; budgetMs: number; minPostMs: number };
export const DEFAULT_DISPATCH_OPTIONS: DispatchOptions = { maxPosts: 5, budgetMs: 45_000, minPostMs: 15_000 };

export type DispatchSummary = {
  disabled: boolean;
  claimed: number;
  published: number;
  retrying: number;
  failed: number;
  uncertain: number;
  returned: number;
};

export async function runDispatch(deps: DispatchDeps, options: DispatchOptions = DEFAULT_DISPATCH_OPTIONS): Promise<DispatchSummary> {
  const summary: DispatchSummary = { disabled: !deps.enabled, claimed: 0, published: 0, retrying: 0, failed: 0, uncertain: 0, returned: 0 };
  if (!deps.enabled) return summary;

  const startedAt = deps.now();
  const posts = await deps.claim(options.maxPosts);
  summary.claimed = posts.length;
  const classify = deps.classify ?? decideAfterError;

  for (const post of posts) {
    if (options.budgetMs - (deps.now() - startedAt) < options.minPostMs) {
      summary.returned++;
      await deps.release(post).catch(() => undefined);
      continue;
    }

    let providerPostId: string;
    try {
      providerPostId = await deps.publish(post);
    } catch (error) {
      const decision = classify(error, post.attempt);
      try {
        if (decision.action === "retry") {
          await deps.finishRetry(post, decision.code, decision.delaySeconds);
          summary.retrying++;
        } else if (decision.action === "uncertain") {
          await deps.finishFailed(post, "uncertain_result");
          summary.uncertain++;
        } else {
          await deps.finishFailed(post, decision.code);
          summary.failed++;
          if (decision.pageProblem && deps.onPageProblem) await deps.onPageProblem(post, decision.pageProblem).catch(() => undefined);
        }
      } catch {
        // The lease will expire and the post becomes "uncertain_result": a person decides.
      }
      continue;
    }

    // The post IS on Facebook. Recording it is retried; the publish itself is never repeated.
    let recorded = false;
    for (let tries = 0; tries < 3 && !recorded; tries++) {
      try {
        recorded = await deps.finishPublished(post, providerPostId);
        break;
      } catch {
        recorded = false;
      }
    }
    summary.published++;
  }
  return summary;
}
