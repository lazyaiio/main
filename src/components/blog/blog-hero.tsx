import Link from "next/link";
import { BLOG_CATEGORIES } from "@/lib/blog";

/** The top of the blog pages: a title, a short promise, and the topic chips. */
export function BlogHero({ title, subtitle, active }: { title: string; subtitle: string; active?: string | null }) {
  return (
    <header className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-100/60 blur-3xl" />
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">The LazyAI Blog</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-600">{subtitle}</p>
        <nav aria-label="Topics" className="mt-8 flex flex-wrap gap-2">
          <Link href="/blog" aria-current={!active ? "true" : undefined} className={`rounded-full border px-4 py-2 text-sm font-medium ${!active ? "border-ink bg-ink text-white" : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"}`}>
            All articles
          </Link>
          {BLOG_CATEGORIES.map((c) => (
            <Link key={c.slug} href={`/blog/category/${c.slug}`} aria-current={active === c.slug ? "true" : undefined} className={`rounded-full border px-4 py-2 text-sm font-medium ${active === c.slug ? "border-ink bg-ink text-white" : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"}`}>
              {c.name}
            </Link>
          ))}
          <Link href="/tools" className="rounded-full border border-brand bg-white px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-50">
            Free tools
          </Link>
        </nav>
      </div>
    </header>
  );
}
