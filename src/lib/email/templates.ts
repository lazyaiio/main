import { describeScheduleError } from "@/lib/schedule-text";

/**
 * Plain, accessible HTML emails with a text version. American English only.
 * Every value that comes from a person or from data is escaped before it goes into HTML.
 */

export type TemplateName = "welcome" | "verify_email" | "campaign_complete" | "publish_failed" | "page_attention" | "test";

export type TemplateData =
  | { template: "welcome"; name: string | null }
  | { template: "verify_email"; name: string | null; verifyUrl: string }
  | { template: "campaign_complete"; campaignName: string; campaignId: string; completed: number; failed: number; total: number; ok: boolean }
  | { template: "publish_failed"; pageName: string; postSnippet: string; code: string; itemId: string }
  | { template: "page_attention"; pageName: string; problem: string }
  | { template: "test" };

export type RenderedEmail = { subject: string; html: string; text: string };

const INK = "#0E1722";
const BLUE = "#006FFE";

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Removes line breaks and control characters, so a value can never add headers or break the subject line. */
export function oneLine(value: string, max = 120): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function layout(input: { title: string; paragraphs: string[]; button?: { label: string; url: string }; footer: string }): string {
  const body = input.paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${INK};">${p}</p>`).join("");
  const button = input.button
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(input.button.url)}" style="background:${BLUE};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;display:inline-block;">${escapeHtml(input.button.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title></head><body style="margin:0;background:#f4f6f9;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:14px;padding:32px;"><tr><td><p style="margin:0 0 20px;font-size:20px;font-weight:800;color:${INK};">Lazy<span style="color:${BLUE};">AI</span></p><h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${INK};">${escapeHtml(input.title)}</h1>${body}${button}<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#5b6676;">${input.footer}</p></td></tr></table></td></tr></table></body></html>`;
}

function link(appUrl: string, path: string): string {
  return `${appUrl.replace(/\/+$/, "")}${path}`;
}

const PREFS_NOTE = (appUrl: string) => `You can choose which emails you get in <a href="${escapeHtml(link(appUrl, "/app/settings"))}" style="color:#5b6676;">Settings</a>.`;
const PREFS_TEXT = (appUrl: string) => `You can choose which emails you get in Settings: ${link(appUrl, "/app/settings")}`;

export function renderEmail(data: TemplateData, appUrl: string): RenderedEmail {
  switch (data.template) {
    case "welcome": {
      const hello = data.name ? `Hi ${oneLine(data.name, 60)},` : "Hi,";
      const url = link(appUrl, "/app");
      return {
        subject: "Welcome to LazyAI",
        html: layout({
          title: "Welcome to LazyAI",
          paragraphs: [
            escapeHtml(hello),
            "Your workspace is ready. Plan a campaign, let the AI write the posts, then schedule them to your Facebook Page.",
            "Nothing is published unless you schedule it.",
          ],
          button: { label: "Open LazyAI", url },
          footer: "You are receiving this because you created a LazyAI account.",
        }),
        text: `${hello}\n\nYour workspace is ready. Plan a campaign, let the AI write the posts, then schedule them to your Facebook Page.\n\nNothing is published unless you schedule it.\n\nOpen LazyAI: ${url}\n\nYou are receiving this because you created a LazyAI account.`,
      };
    }

    case "verify_email": {
      const hello = data.name ? `Hi ${oneLine(data.name, 60)},` : "Hi,";
      return {
        subject: "Verify your email to start using LazyAI",
        html: layout({
          title: "Verify your email",
          paragraphs: [escapeHtml(hello), "Please confirm that this is your email address. Until you do, your LazyAI account can be viewed but not used.", "The link works for 48 hours."],
          button: { label: "Verify my email", url: data.verifyUrl },
          footer: "If you did not create a LazyAI account, you can ignore this email.",
        }),
        text: `${hello}\n\nPlease confirm that this is your email address. Until you do, your LazyAI account can be viewed but not used.\n\nVerify my email: ${data.verifyUrl}\n\nThe link works for 48 hours. If you did not create a LazyAI account, you can ignore this email.`,
      };
    }

    case "campaign_complete": {
      const name = oneLine(data.campaignName, 80);
      const url = link(appUrl, `/app/campaigns/${encodeURIComponent(data.campaignId)}`);
      const summary = data.ok
        ? `${data.completed} of ${data.total} posts were written${data.failed > 0 ? `, and ${data.failed} could not be written` : ""}. They are saved in Content, ready for you to schedule.`
        : "None of the posts could be written. Open the campaign to see why and to try again.";
      return {
        subject: data.ok ? `Your campaign “${name}” is ready` : `Your campaign “${name}” needs attention`,
        html: layout({
          title: data.ok ? "Your campaign is ready" : "Your campaign needs attention",
          paragraphs: [`Campaign: <strong>${escapeHtml(name)}</strong>`, escapeHtml(summary)],
          button: { label: "Open the campaign", url },
          footer: PREFS_NOTE(appUrl),
        }),
        text: `Campaign: ${name}\n\n${summary}\n\nOpen the campaign: ${url}\n\n${PREFS_TEXT(appUrl)}`,
      };
    }

    case "publish_failed": {
      const page = oneLine(data.pageName, 80);
      const snippet = oneLine(data.postSnippet, 100);
      const reason = describeScheduleError(data.code) ?? "Something went wrong while publishing.";
      const url = link(appUrl, `/app/content/${encodeURIComponent(data.itemId)}`);
      return {
        subject: `A post could not be published to ${page}`,
        html: layout({
          title: "A scheduled post was not published",
          paragraphs: [`Page: <strong>${escapeHtml(page)}</strong>`, `Post: “${escapeHtml(snippet)}”`, escapeHtml(reason)],
          button: { label: "Review the post", url },
          footer: PREFS_NOTE(appUrl),
        }),
        text: `A scheduled post was not published.\n\nPage: ${page}\nPost: “${snippet}”\n\n${reason}\n\nReview the post: ${url}\n\n${PREFS_TEXT(appUrl)}`,
      };
    }

    case "page_attention": {
      const page = oneLine(data.pageName, 80);
      const reason = describeScheduleError(data.problem) ?? "The connection needs attention.";
      const url = link(appUrl, "/app/pages");
      return {
        subject: `Reconnect ${page} to keep posting`,
        html: layout({
          title: "A Facebook Page needs to be reconnected",
          paragraphs: [`Page: <strong>${escapeHtml(page)}</strong>`, escapeHtml(reason), "Until it is reconnected, scheduled posts for this Page will not be published."],
          button: { label: "Open Facebook Pages", url },
          footer: PREFS_NOTE(appUrl),
        }),
        text: `A Facebook Page needs to be reconnected.\n\nPage: ${page}\n\n${reason}\n\nUntil it is reconnected, scheduled posts for this Page will not be published.\n\nOpen Facebook Pages: ${url}\n\n${PREFS_TEXT(appUrl)}`,
      };
    }

    default:
      return {
        subject: "LazyAI test email",
        html: layout({
          title: "Your email setup works",
          paragraphs: ["This is a test email from LazyAI. If you can read it, sending is configured correctly."],
          footer: "Sent from the LazyAI admin area.",
        }),
        text: "This is a test email from LazyAI. If you can read it, sending is configured correctly.",
      };
  }
}
