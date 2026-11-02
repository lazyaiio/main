import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbLd } from "@/lib/seo";
import { pageMetadata, siteBase } from "@/lib/services/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/tools");
}

const TOOLS = [
  { href: "/tools/post-idea-generator", name: "Facebook Post Idea Generator", text: "Pick your kind of business and your goal. Get twelve post ideas with an opening line for each, and ask for a fresh set any time." },
  { href: "/tools/content-calendar-generator", name: "Content Calendar Generator", text: "Plan up to twelve weeks of Facebook posts on the days and times you choose, then download the calendar as a CSV file for your spreadsheet." },
  { href: "/tools/post-checker", name: "Facebook Post Checker", text: "Paste a draft to see its length, first line, call to action, hashtags, and how easy it is to read, with plain suggestions to improve it." },
];

export default function ToolsPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd(siteBase(), [{ name: "Free tools", path: "/tools" }])} />
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Free tools</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">Free tools for Facebook Page owners</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-600">Three small tools that make planning and writing posts easier. They are free, they need no sign-up, and they run in your browser, so your text is not stored or sent anywhere.</p>
        </div>
      </section>
      <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 pb-20 sm:px-6 md:grid-cols-3">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="group flex flex-col rounded-2xl border border-ink-100 bg-white p-6 shadow-card transition-shadow hover:shadow-soft">
            <h2 className="font-display text-xl font-bold text-ink group-hover:text-brand">{t.name}</h2>
            <p className="mt-2 flex-1 text-ink-600">{t.text}</p>
            <span className="mt-4 text-sm font-semibold text-brand">Open the tool →</span>
          </Link>
        ))}
      </section>
    </>
  );
}
