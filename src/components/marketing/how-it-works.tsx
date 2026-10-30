import type { HomeContent } from "@/lib/home-content";

export function HowItWorks({ content }: { content: HomeContent["how"] }) {
  return (
    <section id="how" className="scroll-mt-20 bg-ink-50 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {content.title}
        </h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {content.steps.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
