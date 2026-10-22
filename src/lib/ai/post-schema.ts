import { z } from "zod";
import { POST_FORMAT_VALUES, POST_LENGTH_VALUES } from "@/lib/post-formats";
import { TONES } from "@/lib/projects";

/** What the user asks for (validated before any prompt is built). */
export const postRequestSchema = z
  .object({
    projectId: z.string().uuid("Choose a project."),
    language: z.enum(["en", "bn"], { message: "Choose a language." }),
    format: z.enum(POST_FORMAT_VALUES, { message: "Choose a format." }),
    topic: z.string().trim().max(300, "Keep the topic under 300 characters.").optional(),
    /** An article to base the post on. The page is read on the server and rewritten, never copied. */
    sourceUrl: z.string().trim().max(2000, "That link is too long.").optional(),
    length: z.enum(POST_LENGTH_VALUES, { message: "Choose a length." }),
    tone: z.enum(TONES).optional(),
    audience: z.string().trim().max(200, "Audience: 200 characters or fewer.").optional(),
    notes: z.string().trim().max(500, "Notes: 500 characters or fewer.").optional(),
    cta: z.string().trim().max(200, "Call to action: 200 characters or fewer.").optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.sourceUrl && (!value.topic || value.topic.length < 2)) {
      ctx.addIssue({
        code: "custom",
        path: ["topic"],
        message: "Enter a topic (at least 2 characters) or paste an article link.",
      });
    }
  });

export type PostRequest = z.infer<typeof postRequestSchema>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value ?? "");

export function cleanHashtags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.replace(/^#+/, "").replace(/\s+/g, "").trim();
    if (!tag || tag.length > 40) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= 10) break;
  }
  return result;
}

/** What we require back from the model. */
export const postOutputSchema = z.object({
  hook: optionalText(300),
  body: z.string().trim().min(1, "body is empty").max(5000, "body is too long"),
  cta: optionalText(300),
  hashtags: z
    .array(z.string())
    .nullish()
    .transform((tags) => cleanHashtags(tags ?? [])),
  image_brief: optionalText(1000),
  fact_check_flags: z
    .array(z.string().trim().max(300))
    .nullish()
    .transform((flags) => (flags ?? []).filter(Boolean).slice(0, 8)),
});

export type PostOutput = z.infer<typeof postOutputSchema>;

/** Pull a JSON object out of model text, tolerating code fences and stray words. */
export function extractJsonObject(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object found");
  return JSON.parse(stripped.slice(start, end + 1));
}

const BENGALI = /[\u0980-\u09FF]/g;
const LATIN = /[A-Za-z]/g;

/** Returns a problem description, or null when the text matches the requested language. */
export function checkLanguage(text: string, language: "en" | "bn"): string | null {
  const bengali = (text.match(BENGALI) ?? []).length;
  const latin = (text.match(LATIN) ?? []).length;
  const letters = bengali + latin;
  if (letters === 0) return "the body has no letters";
  if (language === "bn" && bengali / letters < 0.6) return "the body must be written in Bengali script";
  if (language === "en" && bengali > 0) return "the body must be written in English only";
  return null;
}
