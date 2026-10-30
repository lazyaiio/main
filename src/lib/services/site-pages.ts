import "server-only";
import { getSitePage } from "@/lib/data/site-pages";
import { DELETION_DAYS, LEGAL_UPDATED_AT, contactEmail, operatorCountry, operatorName } from "@/lib/legal";
import { applyTokens, parseMarkdown, tableOfContents, type Block } from "@/lib/markdown";
import { buildTokens, defaultPage, type PageSlug } from "@/lib/site-pages";

export type PageContent = {
  title: string;
  intro: string;
  blocks: Block[];
  toc: { id: string; label: string }[];
  /** Shown as "Last updated". */
  updatedAt: string;
  customized: boolean;
};

export function pageTokensFromEnv() {
  return buildTokens({ operator: operatorName(), country: operatorCountry(), contactEmail: contactEmail(), deletionDays: DELETION_DAYS });
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" });

/** What a public page shows: the saved version from Admin -> Pages, or the built-in text. */
export async function loadPageContent(slug: PageSlug): Promise<PageContent> {
  const saved = await getSitePage(slug);
  const base = defaultPage(slug);
  const source = saved ?? { ...base, updated_at: "" };
  const tokens = pageTokensFromEnv();
  const blocks = parseMarkdown(applyTokens(source.body, tokens));
  return {
    title: source.title,
    intro: applyTokens(source.intro, tokens),
    blocks,
    toc: tableOfContents(blocks),
    updatedAt: saved ? formatDate(saved.updated_at) : LEGAL_UPDATED_AT,
    customized: Boolean(saved),
  };
}
