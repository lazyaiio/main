import { z } from "zod";
import type { Language } from "@/lib/data/types";
import { POST_FORMAT_VALUES, POST_LENGTH_VALUES, type PostFormat } from "@/lib/post-formats";
import { TONES } from "@/lib/projects";
import { localToUtc, todayInZone } from "@/lib/zone-time";

/** Hard limits, mirrored by the database function that stores a plan. */
export const MAX_CAMPAIGN_ITEMS = 90;
export const MAX_CAMPAIGN_DAYS = 90;
export const MAX_THEMES = 20;
/** Posts planned for the next few minutes are skipped so a plan never starts in the past. */
const MIN_LEAD_MS = 10 * 60 * 1000;
const MAX_START_DAYS_AHEAD = 365;

export { DURATION_PRESETS, TIME_CHOICES, WEEKDAYS } from "./campaign-options";
export { localToUtc, todayInZone };

// ---------------------------------------------------------------------------------------------
// Date helpers (calendar dates are plain "YYYY-MM-DD" strings in the workspace timezone)
// ---------------------------------------------------------------------------------------------

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDateString(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toUtcDate(value: string): Date {
  const match = DATE_RE.exec(value);
  if (!match) throw new Error("Invalid date");
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const date = toUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcDate(date);
}

export function weekdayOf(value: string): number {
  return toUtcDate(value).getUTCDay();
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000);
}

// ---------------------------------------------------------------------------------------------
// Form validation
// ---------------------------------------------------------------------------------------------

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export const campaignFormSchema = z
  .object({
    name: z.string().trim().min(1, "Give the campaign a name.").max(120, "Use 120 characters or fewer for the name."),
    projectId: z.string().uuid("Choose a project."),
    topic: z.string().trim().max(300, "Keep the topic under 300 characters.").optional(),
    sourceUrl: z.string().trim().max(2000, "That link is too long.").optional(),
    startDate: z.string().refine(isValidDateString, "Choose a valid start date."),
    durationDays: z.coerce
      .number({ message: "Choose how long the campaign runs." })
      .int("Choose how long the campaign runs.")
      .min(1, "A campaign runs at least 1 day.")
      .max(MAX_CAMPAIGN_DAYS, `A campaign can run at most ${MAX_CAMPAIGN_DAYS} days.`),
    itemCount: z.coerce
      .number({ message: "Enter how many posts you want." })
      .int("Enter a whole number of posts.")
      .min(1, "Plan at least 1 post.")
      .max(MAX_CAMPAIGN_ITEMS, `A campaign can have at most ${MAX_CAMPAIGN_ITEMS} posts.`),
    languages: z
      .array(z.enum(["en", "bn"]))
      .min(1, "Choose at least one language.")
      .max(2)
      .transform((list) => Array.from(new Set(list))),
    formats: z.array(z.enum(POST_FORMAT_VALUES)).min(1, "Choose at least one post format."),
    postingDays: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, "Choose at least one posting day.")
      .transform((list) => Array.from(new Set(list)).sort((a, b) => a - b)),
    times: z
      .array(z.string().regex(TIME_RE, "Choose valid posting times."))
      .min(1, "Choose at least one posting time.")
      .max(4, "Choose up to 4 posting times per day.")
      .transform((list) => Array.from(new Set(list)).sort()),
    length: z.enum(POST_LENGTH_VALUES, { message: "Choose a post length." }),
    tone: z.enum(TONES).optional(),
    audience: z.string().trim().max(200, "Audience: 200 characters or fewer.").optional(),
    notes: z.string().trim().max(500, "Notes: 500 characters or fewer.").optional(),
    cta: z.string().trim().max(200, "Call to action: 200 characters or fewer.").optional(),
    themes: z
      .array(z.string().trim().min(1).max(120, "Each angle must be 120 characters or fewer."))
      .max(MAX_THEMES, `Use at most ${MAX_THEMES} angles.`),
  })
  .superRefine((value, ctx) => {
    if (!value.sourceUrl && (!value.topic || value.topic.length < 2)) {
      ctx.addIssue({ code: "custom", path: ["topic"], message: "Enter a topic (at least 2 characters) or paste an article link." });
    }
    if (value.sourceUrl && !isHttpUrl(value.sourceUrl)) {
      ctx.addIssue({ code: "custom", path: ["sourceUrl"], message: "Enter a full web address starting with http:// or https://." });
    }
  });

export type CampaignFormInput = z.infer<typeof campaignFormSchema>;

/** One angle per line, blank lines ignored. */
export function parseThemes(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Reads the raw form fields without trusting their shape. */
export function readCampaignForm(formData: FormData) {
  const str = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : "";
  };
  const list = (key: string) => formData.getAll(key).filter((v): v is string => typeof v === "string");
  return {
    name: str("name"),
    projectId: str("projectId"),
    topic: str("topic") || undefined,
    sourceUrl: str("sourceUrl") || undefined,
    startDate: str("startDate"),
    durationDays: str("durationDays"),
    itemCount: str("itemCount"),
    languages: list("languages"),
    formats: list("formats"),
    postingDays: list("postingDays"),
    times: list("times"),
    length: str("length"),
    tone: str("tone") || undefined,
    audience: str("audience") || undefined,
    notes: str("notes") || undefined,
    cta: str("cta") || undefined,
    themes: parseThemes(str("themes")),
  };
}

// ---------------------------------------------------------------------------------------------
// The proposed calendar
// ---------------------------------------------------------------------------------------------

export type PlannedSlot = {
  index: number;
  /** Local calendar date in the workspace timezone. */
  localDate: string;
  /** Local time, "HH:MM". */
  localTime: string;
  /** The same moment in UTC (ISO 8601). */
  plannedAt: string;
  language: Language;
  format: PostFormat;
  theme: string | null;
};

export type PlanInput = {
  startDate: string;
  durationDays: number;
  itemCount: number;
  languages: Language[];
  formats: PostFormat[];
  postingDays: number[];
  times: string[];
  themes: string[];
  timeZone: string;
  now: Date;
};

export type PlanResult =
  | { ok: true; slots: PlannedSlot[]; postingSlots: number }
  | { ok: false; error: string };

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * Spreads the requested posts evenly over the posting days and times of the campaign window.
 * Pure and deterministic: the same input always gives the same plan, so the server can rebuild
 * exactly what the user previewed.
 *
 * With two languages, posts alternate between them and each pair shares a format and an angle.
 */
export function buildPlan(input: PlanInput): PlanResult {
  const { startDate, durationDays, itemCount, languages, formats, postingDays, themes, timeZone, now } = input;

  if (!isValidDateString(startDate)) return { ok: false, error: "Choose a valid start date." };
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > MAX_CAMPAIGN_DAYS) {
    return { ok: false, error: `A campaign runs between 1 and ${MAX_CAMPAIGN_DAYS} days.` };
  }
  if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > MAX_CAMPAIGN_ITEMS) {
    return { ok: false, error: `A campaign has between 1 and ${MAX_CAMPAIGN_ITEMS} posts.` };
  }
  if (languages.length < 1 || languages.length > 2) return { ok: false, error: "Choose one or two languages." };
  if (formats.length < 1) return { ok: false, error: "Choose at least one post format." };
  if (postingDays.length < 1) return { ok: false, error: "Choose at least one posting day." };

  const times = Array.from(new Set(input.times)).filter((t) => TIME_RE.test(t)).sort();
  if (times.length < 1) return { ok: false, error: "Choose at least one posting time." };

  const today = todayInZone(now, timeZone);
  if (startDate < today) return { ok: false, error: "The start date cannot be in the past." };
  if (daysBetween(today, startDate) > MAX_START_DAYS_AHEAD) {
    return { ok: false, error: "Choose a start date within the next year." };
  }

  const earliest = now.getTime() + MIN_LEAD_MS;
  const candidates: { localDate: string; localTime: string; at: Date }[] = [];
  let eligibleDays = 0;
  for (let offset = 0; offset < durationDays; offset++) {
    const localDate = addDays(startDate, offset);
    if (!postingDays.includes(weekdayOf(localDate))) continue;
    eligibleDays++;
    for (const localTime of times) {
      const at = localToUtc(localDate, localTime, timeZone);
      if (at.getTime() >= earliest) candidates.push({ localDate, localTime, at });
    }
  }

  if (eligibleDays === 0) {
    return { ok: false, error: "None of the days in this date range match the posting days you chose." };
  }
  if (candidates.length === 0) {
    return { ok: false, error: "Every posting time in this range has already passed. Choose a later start date." };
  }
  if (itemCount > candidates.length) {
    return {
      ok: false,
      error:
        `You asked for ${plural(itemCount, "post")}, but this schedule has room for only ${plural(candidates.length, "post")} ` +
        `(${plural(eligibleDays, "posting day")} with ${plural(times.length, "time")} each). ` +
        "Add posting days or times, lengthen the campaign, or ask for fewer posts.",
    };
  }

  const slots: PlannedSlot[] = [];
  for (let i = 0; i < itemCount; i++) {
    const candidate = candidates[Math.floor((i * candidates.length) / itemCount)];
    const group = Math.floor(i / languages.length);
    const language = languages[i % languages.length];
    const format = formats[group % formats.length];
    if (!candidate || !language || !format) return { ok: false, error: "The plan could not be built. Please check your choices." };
    slots.push({
      index: i,
      localDate: candidate.localDate,
      localTime: candidate.localTime,
      plannedAt: candidate.at.toISOString(),
      language,
      format,
      theme: themes.length > 0 ? (themes[group % themes.length] ?? null) : null,
    });
  }
  return { ok: true, slots, postingSlots: candidates.length };
}

/** What the generator needs to know about the campaign, stored in campaigns.brief. */
export type CampaignBriefInput = {
  topic: string | null;
  tone: string | null;
  audience: string | null;
  notes: string | null;
  cta: string | null;
  length: string;
  sourceDocumentId: string | null;
  sourceUrl: string | null;
};

export function briefToJson(brief: CampaignBriefInput): Record<string, string> {
  const json: Record<string, string> = { length: brief.length };
  if (brief.topic) json.topic = brief.topic;
  if (brief.tone) json.tone = brief.tone;
  if (brief.audience) json.audience = brief.audience;
  if (brief.notes) json.notes = brief.notes;
  if (brief.cta) json.cta = brief.cta;
  if (brief.sourceDocumentId) json.source_document_id = brief.sourceDocumentId;
  if (brief.sourceUrl) json.source_url = brief.sourceUrl;
  return json;
}

/** Slot fields in the shape the database function expects. */
export function slotsToJson(slots: PlannedSlot[]) {
  return slots.map((slot) => ({
    planned_at: slot.plannedAt,
    language: slot.language,
    content_format: slot.format,
    theme: slot.theme,
  }));
}
