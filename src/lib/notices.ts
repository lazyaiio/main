/**
 * Announcement banner and maintenance mode (pure: no database, no network).
 * Everything an admin types here is shown to visitors, so it must be English (American) plain text.
 */

export const NOTICE_TONES = ["info", "success", "warning"] as const;
export type NoticeTone = (typeof NOTICE_TONES)[number];

export type SiteNotice = {
  announcement: { enabled: boolean; text: string; tone: NoticeTone; linkLabel: string; linkUrl: string };
  maintenance: { enabled: boolean; message: string };
};

export const NOTICE_LIMITS = { text: 160, linkLabel: 30, linkUrl: 200, message: 300 } as const;

export const DEFAULT_MAINTENANCE_MESSAGE = "LazyAI is down for a short maintenance. Your posts and schedules are safe. Please check back soon.";

export const DEFAULT_NOTICE: SiteNotice = {
  announcement: { enabled: false, text: "", tone: "info", linkLabel: "", linkUrl: "" },
  maintenance: { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE },
};

const BENGALI = /[\u0980-\u09FF]/;
const MARKUP = /[<>]/;

function oneLine(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** A link may go to a page on this site ("/pricing") or to a secure address ("https://..."). Nothing else. */
export function isSafeNoticeLink(value: string): boolean {
  if (value === "") return true;
  if (value.length > NOTICE_LIMITS.linkUrl) return false;
  if (value.startsWith("/")) return !value.startsWith("//") && /^\/[A-Za-z0-9\-._~/?#=&%]*$/.test(value);
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".") && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Reads whatever is stored and always returns a complete, safe object (bad or missing parts fall back to defaults). */
export function normalizeNotice(value: unknown): SiteNotice {
  const root = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const a = root.announcement && typeof root.announcement === "object" ? (root.announcement as Record<string, unknown>) : {};
  const m = root.maintenance && typeof root.maintenance === "object" ? (root.maintenance as Record<string, unknown>) : {};
  const tone = (NOTICE_TONES as readonly string[]).includes(a.tone as string) ? (a.tone as NoticeTone) : "info";
  const text = oneLine(a.text, NOTICE_LIMITS.text);
  const linkUrl = oneLine(a.linkUrl, NOTICE_LIMITS.linkUrl);
  const safeLink = isSafeNoticeLink(linkUrl) && linkUrl !== "";
  return {
    // A banner without words is never shown.
    announcement: {
      enabled: a.enabled === true && text !== "",
      text,
      tone,
      linkLabel: safeLink ? oneLine(a.linkLabel, NOTICE_LIMITS.linkLabel) : "",
      linkUrl: safeLink ? linkUrl : "",
    },
    maintenance: { enabled: m.enabled === true, message: oneLine(m.message, NOTICE_LIMITS.message) || DEFAULT_MAINTENANCE_MESSAGE },
  };
}

export type NoticeParse = { ok: true; value: SiteNotice } | { ok: false; error: string };

/** Checks what an admin typed. Stricter than normalizeNotice: it explains the problem instead of quietly fixing it. */
export function parseNoticeForm(raw: {
  announcementEnabled: boolean;
  text: unknown;
  tone: unknown;
  linkLabel: unknown;
  linkUrl: unknown;
  maintenanceEnabled: boolean;
  message: unknown;
}): NoticeParse {
  const text = oneLine(raw.text, NOTICE_LIMITS.text + 1);
  const linkLabel = oneLine(raw.linkLabel, NOTICE_LIMITS.linkLabel + 1);
  const linkUrl = typeof raw.linkUrl === "string" ? raw.linkUrl.trim() : "";
  const message = oneLine(raw.message, NOTICE_LIMITS.message + 1);

  for (const [label, value] of [["The banner text", text], ["The link label", linkLabel], ["The maintenance message", message]] as const) {
    if (BENGALI.test(value)) return { ok: false, error: `${label} must be in English. The website never shows Bengali text.` };
    if (MARKUP.test(value)) return { ok: false, error: `${label} cannot contain < or > characters.` };
  }
  if (text.length > NOTICE_LIMITS.text) return { ok: false, error: `Keep the banner text under ${NOTICE_LIMITS.text} characters.` };
  if (linkLabel.length > NOTICE_LIMITS.linkLabel) return { ok: false, error: `Keep the link label under ${NOTICE_LIMITS.linkLabel} characters.` };
  if (message.length > NOTICE_LIMITS.message) return { ok: false, error: `Keep the maintenance message under ${NOTICE_LIMITS.message} characters.` };
  if (raw.announcementEnabled && text === "") return { ok: false, error: "Write the banner text before you switch the banner on." };
  if (!isSafeNoticeLink(linkUrl)) return { ok: false, error: "The link must start with / (a page on this site) or https://." };
  if (linkUrl !== "" && linkLabel === "") return { ok: false, error: "Add a short label for the link, for example Learn more." };
  if (linkUrl === "" && linkLabel !== "") return { ok: false, error: "Add the link address, or clear the link label." };
  const tone = (NOTICE_TONES as readonly string[]).includes(raw.tone as string) ? (raw.tone as NoticeTone) : null;
  if (!tone) return { ok: false, error: "Choose a banner color." };

  return {
    ok: true,
    value: {
      announcement: { enabled: raw.announcementEnabled, text, tone, linkLabel, linkUrl },
      maintenance: { enabled: raw.maintenanceEnabled, message: message || DEFAULT_MAINTENANCE_MESSAGE },
    },
  };
}

/** A short code that changes when the banner text changes, so a visitor who closed one banner sees the next one. */
export function noticeKey(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}
