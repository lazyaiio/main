import Link from "next/link";
import type { ReactNode } from "react";
import { PostCard } from "@/components/blog/post-card";
import { JsonLd } from "@/components/seo/json-ld";
import { listPublished } from "@/lib/data/blog";
import { breadcrumbLd } from "@/lib/seo";
import { loadSeo, siteBase } from "@/lib/services/seo";

export type ToolFaq = { q: string; a: string };

/** The page around a free tool: heading, the tool, how to use it, questions, related guides, and a gentle pointer to LazyAI. */
export async function ToolShell(props: { path: string; name: string; headline: string; intro: string; category: string; steps: string[]; tips: string[]; faq: ToolFaq[]; children: ReactNode }) {
  const [{ settings }, related] = await Promise.all([loadSeo(), listPublished({ category: props.category, perPage: 3 }).catch(() => ({ posts: [], total: 0 }))]);
  const base = siteBase();
  const ld = [
    { "@context": "https://schema.org", "@type": "WebApplication", name: props.name, url: `${base}${props.path}`, description: props.intro, applicationCategory: "BusinessApplication", operatingSystem: "Any", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, publisher: { "@type": "Organization", name: settings.orgName } },
    breadcrumbLd(base, [{ name: "Free tools", path: "/tools" }, { name: props.name, path: props.path }]),
  ];
  return (
    <>
      <JsonLd data={ld} />
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-12 sm:px-6 sm:pt-16">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-600"><Link href="/tools" className="hover:underline">Free tools</Link></nav>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">{props.headline}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-600">{props.intro}</p>
        </div>
      </section>
      <section className="mx-auto w-full max-w-5xl px-4 pb-10 sm:px-6">{props.children}</section>

      <section className="mx-auto grid w-full max-w-5xl gap-8 px-4 pb-12 sm:px-6 md:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-bold">How to use it</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-ink-700">{props.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold">Tips for better results</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-ink-700">{props.tips.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6">
        <h2 className="font-display text-2xl font-bold">Questions</h2>
        <div className="mt-4 divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white">
          {props.faq.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="cursor-pointer font-semibold text-ink">{f.q}</summary>
              <p className="mt-2 text-ink-700">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {related.posts.length > 0 ? (
        <section className="border-t border-ink-100 bg-ink-50">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="font-display text-2xl font-bold">Related guides</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">{related.posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <div className="rounded-3xl bg-ink p-8 text-white sm:p-10">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Want the posts written and scheduled for you?</h2>
          <p className="mt-3 max-w-2xl text-ink-200">LazyAI turns a topic or a website into a content plan and posts you can edit, then schedules them to your Facebook Page.</p>
          <Link href="/pricing" className="mt-6 inline-flex h-11 items-center rounded-xl bg-white px-6 text-sm font-semibold text-ink hover:bg-ink-100">Start free</Link>
        </div>
      </section>
    </>
  );
}
