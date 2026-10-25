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
import { getSocialProvider, getTokenEncryptionKey, isPublishingEnabled } from "@/lib/social/keys";

/**
 * Publishes the posts that are due. Called by the protected scheduler endpoint, never by a browser.
 * Nothing is sent to Facebook unless live publishing has been switched on (or the pretend Facebook
 * is active), and only approved posts on connected Pages are ever published.
 */
export async function dispatchDuePosts(): Promise<DispatchSummary> {
  const provider = getSocialProvider();
  const key = getTokenEncryptionKey();
  const enabled = Boolean(provider && key && isPublishingEnabled());

  const claimed = new Map<string, pub.ClaimedPost>();
  const detail = (post: DuePost): pub.ClaimedPost => {
    const row = claimed.get(post.id);
    if (!row) throw new PrepareError("unexpected", false);
    return row;
  };

  return runDispatch(
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
      finishRetry: (post, code, delay) => pub.finishRetry(post.id, code, delay, MAX_PUBLISH_ATTEMPTS),
      finishFailed: async (post, code) => {
        await pub.finishFailed(post.id, code);
        const row = claimed.get(post.id);
        if (row) await pub.writeSystemAudit(row.workspace_id, "post.publish_failed", "scheduled_post", post.id, { code }).catch(() => undefined);
      },
      release: (post) => pub.releasePost(post.id),

      onPageProblem: async (post, problem) => {
        const row = detail(post);
        const page = await pub.loadPage(row.workspace_id, row.social_page_id);
        if (!page) return;
        await setPageState(row.workspace_id, page.id, { status: "error", errorCode: problem });
        if (problem === "token_expired") await setAccountStatus(row.workspace_id, page.social_account_id, "expired", problem);
      },
    },
    DEFAULT_DISPATCH_OPTIONS,
  );
}
