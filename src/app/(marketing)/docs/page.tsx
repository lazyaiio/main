import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { DOCS, DOC_GROUPS } from "@/content/docs";
import { breadcrumbLd } from "@/lib/seo";
import { pageMetadata, siteBase } from "@/lib/services/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/docs");
}

export default function DocsIndexPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd(siteBase(), [{ name: "Docs", path: "/docs" }])} />
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-12 sm:px-6 sm:pt-16">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><BookOpen className="h-4 w-4" aria-hidden="true" />Docs</p>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">Guides for using LazyAI</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-600">Short, step-by-step guides for connecting your Facebook Page, writing posts, scheduling them, and fixing problems. Start with Getting started.</p>
        </div>
      </section>
      <div className="mx-auto w-full max-w-5xl space-y-10 px-4 pb-16 sm:px-6">
        {DOC_GROUPS.map((group) => (
          <section key={group} aria-labelledby={`g-${group.replace(/\W+/g, "-")}`}>
            <h2 id={`g-${group.replace(/\W+/g, "-")}`} className="font-display text-xl font-bold text-ink">{group}</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {DOCS.filter((d) => d.group === group).map((d) => (
                <li key={d.slug}>
                  <Link href={`/docs/${d.slug}`} className="block h-full rounded-2xl border border-ink-100 bg-white p-5 shadow-card transition-colors hover:border-brand">
                    <h3 className="font-display text-lg font-bold text-ink">{d.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{d.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-sm text-ink-600">Looking for ideas and advice? Read the <Link href="/blog" className="font-semibold text-brand underline">blog</Link> or try the <Link href="/tools" className="font-semibold text-brand underline">free tools</Link>. Need a person? Use the <Link href="/contact" className="font-semibold text-brand underline">contact page</Link>.</p>
      </div>
    </>
  );
}
