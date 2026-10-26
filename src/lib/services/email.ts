import "server-only";
import { after } from "next/server";
import { DEFAULT_PREFS, getPrefs, getUserEmail, getUserName, insertEvent, listWorkspaceAdminIds, updateEvent, type EmailPrefs } from "@/lib/data/email";
import { EmailError, createResendSender } from "@/lib/email/provider";
import { getAppBaseUrl, getEmailConfig } from "@/lib/email/keys";
import { renderEmail, type TemplateData } from "@/lib/email/templates";

/**
 * Sends notification emails. Every function here is safe to call from anywhere: it NEVER throws, so an
 * email problem can never break publishing, campaigns, or sign-up. Problems are recorded in the delivery
 * log (email_events) with a short error code, never with an address, a message, or a key.
 */

export type SendResult = { status: "sent" | "skipped" | "failed"; reason?: string };
type PrefKey = "campaign_complete" | "publish_failures" | "page_alerts";

/** Runs after the response is sent (Next.js `after`), or immediately when there is no request. */
export function runLater(task: () => Promise<unknown>): void {
  const safe = () => task().catch(() => undefined);
  try {
    after(safe);
  } catch {
    void safe();
  }
}

async function record(workspaceId: string | null, userId: string, template: string, dedupeKey: string, status: "skipped", errorCode: string): Promise<void> {
  try {
    await insertEvent({ workspaceId, userId, template, dedupeKey, status, errorCode });
  } catch {
    // The log is best effort.
  }
}

export async function sendNotification(args: {
  data: TemplateData;
  userId: string;
  workspaceId: string | null;
  dedupeKey: string;
  preference: PrefKey | null;
  /** For test emails: report a missing setup as a failure instead of skipping quietly. */
  explicit?: boolean;
}): Promise<SendResult> {
  const { data, userId, workspaceId, dedupeKey } = args;
  try {
    const config = getEmailConfig();
    if (!config.apiKey || !config.from) {
      if (!args.explicit) await record(workspaceId, userId, data.template, dedupeKey, "skipped", "not_configured");
      return { status: args.explicit ? "failed" : "skipped", reason: "not_configured" };
    }

    let prefs: EmailPrefs = DEFAULT_PREFS;
    try {
      prefs = await getPrefs(userId);
    } catch {
      // Use defaults when the choices cannot be read.
    }
    if (prefs.suppressed) {
      await record(workspaceId, userId, data.template, dedupeKey, "skipped", "suppressed");
      return { status: "skipped", reason: "suppressed" };
    }
    if (args.preference && !prefs[args.preference]) {
      await record(workspaceId, userId, data.template, dedupeKey, "skipped", "opted_out");
      return { status: "skipped", reason: "opted_out" };
    }

    const to = await getUserEmail(userId);
    if (!to) {
      await record(workspaceId, userId, data.template, dedupeKey, "skipped", "no_address");
      return { status: "skipped", reason: "no_address" };
    }

    const eventId = await insertEvent({ workspaceId, userId, template: data.template, dedupeKey, status: "queued" });
    if (!eventId) return { status: "skipped", reason: "duplicate" };

    const appUrl = getAppBaseUrl();
    const mail = renderEmail(data, appUrl);
    const headers = args.preference ? { "List-Unsubscribe": `<${appUrl}/app/settings>` } : undefined;
    try {
      const sent = await createResendSender(config.apiKey)({ from: config.from, to, ...mail, idempotencyKey: dedupeKey, headers });
      await updateEvent(eventId, { status: "sent", providerMessageId: sent.id });
      return { status: "sent" };
    } catch (error) {
      const kind = error instanceof EmailError ? error.kind : "temporary";
      await updateEvent(eventId, { status: "failed", errorCode: kind }).catch(() => undefined);
      return { status: "failed", reason: kind };
    }
  } catch {
    return { status: "failed", reason: "unexpected" };
  }
}

// ---------- Ready-made notices ----------

export async function notifyWelcome(userId: string): Promise<void> {
  const name = await getUserName(userId).catch(() => null);
  await sendNotification({ data: { template: "welcome", name }, userId, workspaceId: null, dedupeKey: `welcome:${userId}`, preference: null });
}

export async function notifyCampaignFinished(args: {
  userId: string;
  workspaceId: string;
  campaignId: string;
  name: string;
  completed: number;
  failed: number;
  total: number;
}): Promise<void> {
  await sendNotification({
    data: { template: "campaign_complete", campaignName: args.name, campaignId: args.campaignId, completed: args.completed, failed: args.failed, total: args.total, ok: args.completed > 0 },
    userId: args.userId,
    workspaceId: args.workspaceId,
    dedupeKey: `campaign:${args.campaignId}:finished`,
    preference: "campaign_complete",
  });
}

export async function notifyPublishFailure(args: { workspaceId: string; itemId: string; scheduledPostId: string; pageName: string; code: string; snippet: string }): Promise<void> {
  const recipients = await listWorkspaceAdminIds(args.workspaceId).catch(() => []);
  for (const userId of recipients) {
    await sendNotification({
      data: { template: "publish_failed", pageName: args.pageName, postSnippet: args.snippet, code: args.code, itemId: args.itemId },
      userId,
      workspaceId: args.workspaceId,
      dedupeKey: `publish_failed:${args.scheduledPostId}:${args.code}:${userId}`,
      preference: "publish_failures",
    });
  }
}

export async function notifyPageAttention(args: { workspaceId: string; pageId: string; pageName: string; problem: string }): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const recipients = await listWorkspaceAdminIds(args.workspaceId).catch(() => []);
  for (const userId of recipients) {
    await sendNotification({
      data: { template: "page_attention", pageName: args.pageName, problem: args.problem },
      userId,
      workspaceId: args.workspaceId,
      dedupeKey: `page_attention:${args.pageId}:${args.problem}:${day}:${userId}`,
      preference: "page_alerts",
    });
  }
}

/** Admin test: a real email to the admin's own address. Reports problems instead of hiding them. */
export async function sendTestEmail(userId: string): Promise<SendResult> {
  return sendNotification({ data: { template: "test" }, userId, workspaceId: null, dedupeKey: `test:${userId}:${Date.now()}`, preference: null, explicit: true });
}
