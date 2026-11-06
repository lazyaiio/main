import { z } from "zod";

/**
 * Support inbox rules (pure: no database, no network). American English only.
 * People may write their message in any language, including Bengali. Only the website's own text is English only.
 */

export const SUPPORT_TOPICS = [
  { value: "support", label: "Help with my account or a post" },
  { value: "privacy", label: "Privacy or data request" },
  { value: "report", label: "Report content or a security problem" },
  { value: "business", label: "Plans, billing, or partnerships" },
  { value: "other", label: "Something else" },
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number]["value"];
export const SUPPORT_TOPIC_VALUES = SUPPORT_TOPICS.map((t) => t.value) as [SupportTopic, ...SupportTopic[]];

export const SUPPORT_STATUSES = ["new", "open", "closed"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const STATUS_LABELS: Record<SupportStatus, string> = { new: "New", open: "In progress", closed: "Closed" };
export const TOPIC_LABELS: Record<SupportTopic, string> = Object.fromEntries(SUPPORT_TOPICS.map((t) => [t.value, t.label])) as Record<SupportTopic, string>;

export const LIMITS = { name: 80, email: 254, subject: 120, messageMin: 10, message: 4000, note: 2000, reply: 4000 } as const;

/** Removes control characters (keeps new lines and tabs), unifies line breaks, and trims. */
export function cleanText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
}

/** One line only: used for names, subjects, and anything that may end up in an email header or a list. */
export function cleanLine(value: string, max: number): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function isValidEmail(value: string): boolean {
  return value.length <= LIMITS.email && EMAIL_RE.test(value);
}

export type ContactInput = {
  name: string;
  email: string;
  topic: SupportTopic;
  subject: string;
  message: string;
};

export type ContactParse = { ok: true; value: ContactInput } | { ok: false; error: string };

const topicSchema = z.enum(SUPPORT_TOPIC_VALUES);

/** Checks the contact form. The messages are plain words a person can act on. */
export function parseContactForm(raw: { name?: unknown; email?: unknown; topic?: unknown; subject?: unknown; message?: unknown }): ContactParse {
  const name = cleanLine(typeof raw.name === "string" ? raw.name : "", LIMITS.name + 1);
  if (name.length < 1) return { ok: false, error: "Please enter your name." };
  if (name.length > LIMITS.name) return { ok: false, error: `Please use ${LIMITS.name} characters or fewer for your name.` };

  const email = (typeof raw.email === "string" ? raw.email : "").trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: "Please enter a valid email address so we can reply." };

  const topic = topicSchema.safeParse(raw.topic);
  if (!topic.success) return { ok: false, error: "Please choose what your message is about." };

  const subject = cleanLine(typeof raw.subject === "string" ? raw.subject : "", LIMITS.subject + 1);
  if (subject.length > LIMITS.subject) return { ok: false, error: `Please keep the subject under ${LIMITS.subject} characters.` };

  const message = cleanText(typeof raw.message === "string" ? raw.message : "");
  if (message.length < LIMITS.messageMin) return { ok: false, error: "Please write a little more so we can help (at least 10 characters)." };
  if (message.length > LIMITS.message) return { ok: false, error: `Please keep your message under ${LIMITS.message.toLocaleString("en-US")} characters.` };

  return { ok: true, value: { name, email, topic: topic.data, subject, message } };
}

const LINK_RE = /https?:\/\/|www\./gi;

/**
 * Light spam checks that never show a bot anything useful:
 *  - the hidden "website" box must stay empty,
 *  - a person needs a couple of seconds to fill in the form,
 *  - a message with many links is not accepted.
 */
export function looksLikeSpam(input: { website?: unknown; startedAt?: unknown; message: string }, now: number = Date.now()): boolean {
  if (typeof input.website === "string" && input.website.trim() !== "") return true;
  const started = Number(input.startedAt);
  if (!Number.isFinite(started) || started <= 0) return true;
  const elapsed = now - started;
  if (elapsed < 2500) return true;
  if (elapsed > 7 * 24 * 60 * 60 * 1000) return true;
  const links = input.message.match(LINK_RE)?.length ?? 0;
  return links > 3;
}

export const replySchema = z.object({
  id: z.string().uuid(),
  body: z.string().transform(cleanText).pipe(z.string().min(5, "Please write your reply first.").max(LIMITS.reply, `Please keep the reply under ${LIMITS.reply.toLocaleString("en-US")} characters.`)),
});

export const noteSchema = z.object({
  id: z.string().uuid(),
  note: z.string().transform(cleanText).pipe(z.string().max(LIMITS.note)),
});

export const statusSchema = z.object({ id: z.string().uuid(), status: z.enum(SUPPORT_STATUSES) });

export function isSupportStatus(value: unknown): value is SupportStatus {
  return typeof value === "string" && (SUPPORT_STATUSES as readonly string[]).includes(value);
}

/** The subject of a reply email: "Re: ..." on one line, never longer than 120 characters. */
export function replySubject(original: { subject: string; topic: SupportTopic }): string {
  const base = original.subject.trim() || TOPIC_LABELS[original.topic];
  const clean = cleanLine(base.replace(/^(re:\s*)+/i, ""), 100);
  return `Re: ${clean}`;
}
