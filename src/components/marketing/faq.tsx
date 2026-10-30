import { ChevronDown } from "lucide-react";
import type { HomeContent } from "@/lib/home-content";

export function Faq({ content }: { content: HomeContent["faq"] }) {
  return (
    <section id="faq" className="scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {content.title}
        </h2>
        <div className="mt-8 divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white shadow-card">
          {content.items.map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
