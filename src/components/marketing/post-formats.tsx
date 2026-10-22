const samples = [
  {
    format: "Tip",
    text: "Small business tip: reply to every comment within 24 hours. It shows people you are listening and keeps the conversation going.",
  },
  {
    format: "Question",
    text: "What is the one thing that turned you into a loyal customer of a local shop? Tell us in the comments.",
  },
  {
    format: "Checklist",
    text: "Before you post: add a clear hook, keep it under 80 words, and end with one simple question.",
  },
  {
    format: "Myth vs. fact",
    text: "Myth: you need a big budget to get noticed. Fact: steady, helpful posts often do more than one expensive ad.",
  },
];

export function PostFormats() {
  return (
    <section className="bg-ink py-16 text-white md:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Pick the format. <span className="text-brand-200">Keep your voice.</span>
          </h2>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-300">
            Tips, checklists, questions, myth-vs-fact posts, how-tos, and stories. Each post is
            written natively in English or Bengali, and you review it before it goes anywhere.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {samples.map((sample) => (
            <article key={sample.format} className="rounded-2xl bg-white p-5 text-ink">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{sample.format}</p>
              <p className="mt-3 text-sm leading-relaxed">{sample.text}</p>
            </article>
          ))}
          <p className="text-xs text-ink-400 sm:col-span-2">Illustrative examples.</p>
        </div>
      </div>
    </section>
  );
}
