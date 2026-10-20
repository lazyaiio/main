import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Will LazyAI post without my approval?",
    a: "No. Review-before-scheduling is the default. You approve posts before anything is queued.",
  },
  {
    q: "Which platforms are supported?",
    a: "Facebook Pages come first. Personal Facebook profiles are not supported. More platforms may follow later.",
  },
  {
    q: "Which languages can it write in?",
    a: "English and Bengali at launch, either one or both in the same campaign.",
  },
  {
    q: "How do I know a post was really published?",
    a: "LazyAI marks a post as published only after Facebook confirms it. Until then it is shown as scheduled, retrying, or failed.",
  },
  {
    q: "How much does it cost?",
    a: "Pricing will be announced before launch. We will not charge you without telling you first.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Questions, answered
        </h2>
        <div className="mt-8 divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white shadow-card">
          {faqs.map((item) => (
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
