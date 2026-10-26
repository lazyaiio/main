import "server-only";
import { decryptToken } from "@/lib/crypto/token-crypto";
import * as pub from "@/lib/data/publisher";
import { getTokenCiphertext, setAccountStatus, setPageState } from "@/lib/data/social";
import {
  DEFAULT_DISPATCH_OPTIONS,
  MAX_PUBLISH_ATTEMPTS,
  PrepareError,
  composePostMessage,
  runDispatch,
  type DispatchSummary,
  type DuePost,
} from "@/lib/publish-dispatch";
import { adminDb, isLiveFlagOn, recordDispatcherRun } from "@/lib/data/platform";
import { notifyPageAttention, notifyPublishFailure, runLater } from "./email";
import { getSocialMode, getSocialProvider, getTokenEncryptionKey, isPublishingBlockedByEnv } from "@/lib/social/keys";

/**
 * Publishes the posts that are due. Called by the protected scheduler endpoint, never by a browser.
 * Nothing is sent to Facebook unless live publishing has been switched on (or the pretend Facebook
 * is active), and only approved posts on connected Pages are ever published.
 */
export async function dispatchDuePosts(): Promise<DispatchSummary> {
  const provider = getSocialProvider();
  const key = getTokenEncryptionKey();
  // Real posting needs the Admin switch (Admin -> Publishing) and no emergency stop. The pretend Facebook always runs.
  const switchOn = getSocialMode() === "mock" || (!isPublishingBlockedByEnv() && (await isLiveFlagOn(adminDb()).catch(() => false)));
  const enabled = Boolean(provider && key && switchOn);

  const claimed = new Map<string, pub.ClaimedPost>();
  const detail = (post: DuePost): pub.ClaimedPost => {
    const row = claimed.get(post.id);
    if (!row) throw new PrepareError("unexpected", false);
    return row;
  };

  /** Emails the workspace owners about a post that will not go out (not when a person disconnected the Page). */
  const announceFailure = (post: DuePost, code: string) => {
    const row = claimed.get(post.id);
    if (!row || code === "page_disconnected") return;
    runLater(async () => {
      const [item, page] = await Promise.all([pub.loadItem(row.workspace_id, row.content_item_id), pub.loadPage(row.workspace_id, row.social_page_id)]);
      await notifyPublishFailure({
        workspaceId: row.workspace_id,
        itemId: row.content_item_id,
        scheduledPostId: post.id,
        pageName: page?.name ?? "your Facebook Page",
        code,
        snippet: item?.body ?? "",
      });
    });
  };

  const summary = await runDispatch(
    {
      now: () => Date.now(),
      enabled,
      claim: async (limit) => {
        const rows = await pub.claimDuePosts(limit);
        for (const row of rows) claimed.set(row.id, row);
        return rows.map((row) => ({ id: row.id, attempt: row.attempt_count }));
      },

      publish: async (post) => {
        const row = detail(post);
        const ws = row.workspace_id;
        if (!provider || !key) throw new PrepareError("not_configured", false);

        const item = await pub.loadItem(ws, row.content_item_id);
        if (!item) throw new PrepareError("post_missing", false);
        // Edited or un-approved after scheduling: it must be approved again first.
        if (item.approval_status !== "approved") throw new PrepareError("not_approved", false);

        const page = await pub.loadPage(ws, row.social_page_id);
        if (!page) throw new PrepareError("page_missing", false);
        if (page.status !== "connected") throw new PrepareError("page_disconnected", false);
        if (page.capabilities.can_publish !== true) throw new PrepareError("permission_missing", false);

        const cipher = await getTokenCiphertext(ws, page.id);
        if (!cipher) throw new PrepareError("token_missing", false);
        let token: string;
        try {
          token = decryptToken(key, `page:${ws}:${page.provider_page_id}`, cipher);
        } catch {
          throw new PrepareError("token_unreadable", false);
        }

        let image: { bytes: Uint8Array; mime: string } | null;
        try {
          image = await pub.loadImage(ws, item.id);
        } catch {
          throw new PrepareError("image_download", true); // nothing was sent yet, so a retry is safe
        }

        const result = await provider.publish(
          { id: page.provider_page_id, accessToken: token },
          { message: composePostMessage(item), image },
        );
        return result.providerPostId;
      },

      finishPublished: async (post, providerPostId) => {
        const recorded = await pub.finishPublished(post.id, providerPostId);
        const row = claimed.get(post.id);
        if (recorded && row) await pub.writeSystemAudit(row.workspace_id, "post.published", "scheduled_post", post.id, {}).catch(() => undefined);
        return recorded;
      },
      finishRetry: async (post, code, delay) => {
        const status = await pub.finishRetry(post.id, code, delay, MAX_PUBLISH_ATTEMPTS);
        // Out of attempts: tell the owners. (Emails never block or break publishing.)
        if (status === "failed") announceFailure(post, code);
      },
      finishFailed: async (post, code) => {
        await pub.finishFailed(post.id, code);
        const row = claimed.get(post.id);
        if (row) await pub.writeSystemAudit(row.workspace_id, "post.publish_failed", "scheduled_post", post.id, { code }).catch(() => undefined);
        announceFailure(post, code);
      },
      release: (post) => pub.releasePost(post.id),

      onPageProblem: async (post, problem) => {
        const row = detail(post);
        const page = await pub.loadPage(row.workspace_id, row.social_page_id);
        if (!page) return;
        await setPageState(row.workspace_id, page.id, { status: "error", errorCode: problem });
        runLater(() => notifyPageAttention({ workspaceId: row.workspace_id, pageId: page.id, pageName: page.name, problem }));
        if (problem === "token_expired") await setAccountStatus(row.workspace_id, page.social_account_id, "expired", problem);
      },
    },
    DEFAULT_DISPATCH_OPTIONS,
  );

  // Leave a heartbeat so Admin -> Publishing can show that the scheduler is really running.
  await recordDispatcherRun({ ...summary, live_switch: switchOn, configured: Boolean(provider && key) }).catch(() => undefined);
  return summary;
}
