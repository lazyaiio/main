import { z } from "zod";
import type { Language, ProjectInputType, ProjectSettings } from "@/lib/data/types";

export const PROJECT_TYPES: { value: Exclude<ProjectInputType, "csv">; label: string; hint: string }[] = [
  { value: "topic", label: "Topic or keyword", hint: "For example: digital marketing for small shops" },
  { value: "url", label: "Article link", hint: "One article or page to turn into posts" },
  { value: "website", label: "Website", hint: "Your homepage or site address. Paste a specific article link when you write a post." },
];

export const TONES = ["friendly", "professional", "playful", "authoritative", "inspirational"] as const;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export const projectFormSchema = z
  .object({
    name: z.string().trim().min(1, "Give the project a name.").max(120, "Use 120 characters or fewer."),
    inputType: z.enum(["topic", "url", "website"], { message: "Choose what you are starting from." }),
    inputValue: z.string().trim().min(1, "Enter a topic or a link.").max(2000, "That is too long."),
    languages: z
      .array(z.enum(["en", "bn"]))
      .min(1, "Choose at least one language.")
      .max(2),
    audience: z.string().trim().max(200, "Audience: use 200 characters or fewer.").optional(),
    tone: z.enum(TONES).optional(),
    notes: z.string().trim().max(500, "Notes: use 500 characters or fewer.").optional(),
  })
  .superRefine((value, ctx) => {
    if (value.inputType === "topic") {
      if (value.inputValue.length < 2 || value.inputValue.length > 200) {
        ctx.addIssue({ code: "custom", path: ["inputValue"], message: "A topic should be 2 to 200 characters." });
      }
    } else if (!isHttpUrl(value.inputValue)) {
      ctx.addIssue({
        code: "custom",
        path: ["inputValue"],
        message: "Enter a full web address starting with http:// or https://.",
      });
    }
  });

export type ProjectFormInput = z.infer<typeof projectFormSchema>;

export function toProjectSettings(input: ProjectFormInput): ProjectSettings {
  const settings: ProjectSettings = {};
  if (input.audience) settings.audience = input.audience;
  if (input.tone) settings.tone = input.tone;
  if (input.notes) settings.notes = input.notes;
  return settings;
}

/** Reads the raw form fields without trusting their shape. */
export function readProjectForm(formData: FormData) {
  const str = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : "";
  };
  const languages = formData
    .getAll("languages")
    .filter((v): v is string => typeof v === "string");
  const tone = str("tone");
  return {
    name: str("name"),
    inputType: str("inputType"),
    inputValue: str("inputValue"),
    languages,
    audience: str("audience") || undefined,
    tone: tone || undefined,
    notes: str("notes") || undefined,
  };
}

export function languageLabel(language: Language): string {
  return language === "bn" ? "Bengali" : "English";
}
