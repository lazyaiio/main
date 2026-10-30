import { LegalPage } from "@/components/marketing/legal-page";
import { MarkdownContent } from "@/components/marketing/markdown-content";
import { loadPageContent } from "@/lib/services/site-pages";
import type { PageSlug } from "@/lib/site-pages";

/** A public page whose text can be edited in Admin -> Pages. Pass showUpdated={false} for pages that are not policies. */
export async function SitePage({ slug, showUpdated = true, showToc = false }: { slug: PageSlug; showUpdated?: boolean; showToc?: boolean }) {
  const page = await loadPageContent(slug);
  return (
    <LegalPage title={page.title} intro={page.intro || undefined} updatedAt={showUpdated ? page.updatedAt : null} toc={showToc ? page.toc : undefined}>
      <MarkdownContent blocks={page.blocks} />
    </LegalPage>
  );
}
