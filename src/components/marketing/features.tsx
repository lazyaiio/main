import { CalendarDays, CheckCircle2, Clock, Languages, Layers, Link2 } from "lucide-react";

const features = [
  {
    icon: Link2,
    title: "Topic, article, or website",
    body: "Start from a keyword, a single link, or a whole site. LazyAI writes original posts, not copies.",
  },
  {
    icon: Layers,
    title: "Campaigns of 30, 60, or 90 posts",
    body: "Plan a full month at once. Posts are generated in small batches, so nothing is lost if one fails.",
  },
  {
    icon: Languages,
    title: "Written for Bengali, not translated",
    body: "Natural Bengali and English posts that match your audience and brand voice.",
  },
  {
    icon: CheckCircle2,
    title: "You stay in control",
    body: "Edit, regenerate, approve, or reject. Review-before-scheduling is the default.",
  },
  {
    icon: CalendarDays,
    title: "A calendar that makes sense",
    body: "See every post by day and status, in your own timezone (Asia/Dhaka by default).",
  },
  {
    icon: Clock,
    title: "Honest statuses and safe retries",
    body: "Draft, scheduled, published, failed — always accurate. Retries never create duplicate posts.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Everything you need to keep your Page active
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
