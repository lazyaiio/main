import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/marketing/markdown-content";
import { JsonLd } from "@/components/seo/json-ld";
import { DOCS, DOC_GROUPS, getDoc } from "@/content/docs";
import { parseMarkdown, tableOfContents } from "@/lib/markdown";
import { breadcrumbLd } from "@/lib/seo";
import { siteBase } from "@/lib/services/seo";
import { siteConfig } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doc = getDoc((await params).slug);
  if (!doc) return {};
  const url = `${siteBase()}/docs/${doc.slug}`;
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: url },
    openGraph: { title: doc.title, description: doc.description, url, siteName: siteConfig.name, type: "article", locale: "en_US" },
    twitter: { card: "summary", title: doc.title, description: doc.description },
  };
}

export default async function DocPage({ params }: Props) {
  const doc = getDoc((await params).slug);
  if (!doc) notFound();
  const blocks = parseMarkdown(doc.body);
  const toc = tableOfContents(blocks);
  const index = DOCS.findIndex((d) => d.slug === doc.slug);
  const prev = index > 0 ? DOCS[index - 1] : undefined;
  const next = index < DOCS.length - 1 ? DOCS[index + 1] : undefined;
  const base = siteBase();
  const ld = [
    breadcrumbLd(base, [{ name: "Docs", path: "/docs" }, { name: doc.title, path: `/docs/${doc.slug}` }]),
    { "@context": "https://schema.org", "@type": "TechArticle", headline: doc.title, description: doc.description, dateModified: doc.updated, url: `${base}/docs/${doc.slug}`, inLanguage: "en-US", publisher: { "@type": "Organization", name: siteConfig.name } },
  ];

  return (
    <>
      <JsonLd data={ld} />
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Docs" className="lg:sticky lg:top-24 lg:self-start">
          <Link href="/docs" className="text-sm font-semibold text-brand hover:underline">All guides</Link>
          {DOC_GROUPS.map((group) => (
            <div key={group} className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{group}</p>
              <ul className="mt-1 space-y-1">
                {DOCS.filter((d) => d.group === group).map((d) => (
                  <li key={d.slug}>
                    <Link href={`/docs/${d.slug}`} aria-current={d.slug === doc.slug ? "page" : undefined} className={`block rounded-lg px-2 py-1.5 text-sm ${d.slug === doc.slug ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-700 hover:bg-ink-50"}`}>{d.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <article className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-600"><Link href="/docs" className="hover:underline">Docs</Link> <span aria-hidden="true">/</span> {doc.group}</nav>
          <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">{doc.title}</h1>
          <p className="mt-3 text-lg leading-relaxed text-ink-600">{doc.description}</p>
          <p className="mt-2 text-xs text-ink-500">Updated {new Date(`${doc.updated}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}</p>

          {toc.length > 2 ? (
            <nav aria-label="On this page" className="mt-6 rounded-2xl border border-ink-100 bg-ink-50 p-4">
              <p className="text-sm font-semibold text-ink">On this page</p>
              <ul className="mt-2 space-y-1 text-sm">
                {toc.map((t) => <li key={t.id}><a href={`#${t.id}`} className="text-brand hover:underline">{t.label}</a></li>)}
              </ul>
            </nav>
          ) : null}

          <div className="mt-8 space-y-5 text-[1.0625rem] leading-8 text-ink-700 [&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_code]:text-sm [&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-snug [&_h2]:text-ink [&_h3]:mt-8 [&_h3]:scroll-mt-24 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-ink [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
            <MarkdownContent blocks={blocks} />
          </div>

          <aside className="mt-12 rounded-2xl border border-ink-100 bg-white p-5 text-sm text-ink-700">
            Did this not answer your question? <Link href="/contact" className="font-semibold text-brand underline">Write to us</Link> and tell us what you were trying to do.
          </aside>

          <nav aria-label="More guides" className="mt-8 flex flex-wrap justify-between gap-4 text-sm font-semibold">
            {prev ? <Link href={`/docs/${prev.slug}`} className="text-brand hover:underline">Previous: {prev.title}</Link> : <span />}
            {next ? <Link href={`/docs/${next.slug}`} className="text-brand hover:underline">Next: {next.title}</Link> : <span />}
          </nav>
        </article>
      </div>
    </>
  );
}
