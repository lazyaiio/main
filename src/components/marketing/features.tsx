import type { HomeContent } from "@/lib/home-content";
import { CalendarDays, CheckCircle2, Clock, Languages, Layers, Link2 } from "lucide-react";

const icons = [Link2, Layers, Languages, CheckCircle2, CalendarDays, Clock];

export function Features({ content }: { content: HomeContent["features"] }) {
  return (
    <section id="features" className="scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {content.title}
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {content.items.map(({ title, body }, i) => {
            const Icon = icons[i % icons.length] as (typeof icons)[number];
            return (
            <div key={title} className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
