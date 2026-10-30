import { DEFAULT_PAGES } from "@/content/default-pages";
import { escapeMarkdown, type PageTokens } from "@/lib/markdown";

/** Pages whose text an admin can edit as Markdown. */
export const EDITABLE_PAGES = [
  { slug: "terms", label: "Terms of Service", path: "/terms" },
  { slug: "privacy", label: "Privacy Policy", path: "/privacy" },
  { slug: "cookies", label: "Cookie Policy", path: "/cookies" },
  { slug: "acceptable-use", label: "Acceptable Use Policy", path: "/acceptable-use" },
  { slug: "data-deletion", label: "Data Deletion", path: "/data-deletion" },
  { slug: "help", label: "Help", path: "/help" },
  { slug: "contact", label: "Contact", path: "/contact" },
  { slug: "about", label: "About", path: "/about" },
] as const;

export type PageSlug = (typeof EDITABLE_PAGES)[number]["slug"];

export function isPageSlug(value: unknown): value is PageSlug {
  return EDITABLE_PAGES.some((p) => p.slug === value);
}

export function defaultPage(slug: PageSlug) {
  return DEFAULT_PAGES[slug] as { title: string; intro: string; body: string };
}

export const BENGALI = /[\u0980-\u09FF]/;

export type PageInput = { title: string; intro: string; body: string };

/** Returns an error message, or null when the text may be saved. The site is English only, so Bengali characters are refused. */
export function validatePageInput(input: PageInput): string | null {
  const title = input.title.trim();
  if (title.length < 1 || title.length > 120) return "The title must be 1 to 120 characters.";
  if (input.intro.length > 600) return "The introduction can be up to 600 characters.";
  if (input.body.trim().length < 20) return "The page text is too short.";
  if (input.body.length > 60000) return "The page text is too long (60,000 characters at most).";
  if (BENGALI.test(input.title + input.intro + input.body)) return "The site text must be in English. Remove the Bengali characters.";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(input.title + input.intro + input.body)) return "The text contains characters that are not allowed.";
  return null;
}

type TokenSource = { operator: string; country: string | null; contactEmail: string | null; deletionDays: number };

/** Values for the {{tokens}} that pages may use. Values are escaped so they cannot add formatting. */
export function buildTokens(src: TokenSource): PageTokens {
  const country = src.country ? escapeMarkdown(src.country) : null;
  const governing = country
    ? `These Terms are governed by the laws of ${country}, without regard to conflict-of-law rules, and the courts of ${country} have jurisdiction, except where the law of your country gives you mandatory rights.`
    : "These Terms are governed by the laws of the country where the operator of the Service is established, without regard to conflict-of-law rules, except where the law of your country gives you mandatory rights.";
  return {
    operator: escapeMarkdown(src.operator),
    country: country ?? "",
    contact_email: src.contactEmail ? `[${escapeMarkdown(src.contactEmail)}](mailto:${src.contactEmail})` : "[the contact details on our Contact page](/contact)",
    deletion_days: String(src.deletionDays),
    governing_law: governing,
  };
}

export const PAGE_TOKEN_HELP: { token: string; meaning: string }[] = [
  { token: "{{operator}}", meaning: "the name of the company or person who runs the site" },
  { token: "{{contact_email}}", meaning: "the contact email as a link" },
  { token: "{{deletion_days}}", meaning: "days to complete a deletion request" },
  { token: "{{country}}", meaning: "the operator's country (may be empty)" },
  { token: "{{governing_law}}", meaning: "the governing law sentence of the Terms" },
  { token: "{{deletion_check_form}}", meaning: "the confirmation code box (Data Deletion page only; put it on its own line)" },
];
