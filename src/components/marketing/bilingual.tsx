export function Bilingual() {
  return (
    <section className="bg-ink py-16 text-white md:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            One idea. Two languages. <span className="text-brand-200">Both sound natural.</span>
          </h2>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-300">
            Reach your audience in the language they use every day. LazyAI writes each version for
            its readers instead of translating word for word.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl bg-white p-5 text-ink">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">English</p>
            <p className="mt-3 text-sm leading-relaxed">
              Small business tip: reply to every comment within 24 hours. It shows people you are
              listening and keeps the conversation going.
            </p>
          </article>
          <article className="rounded-2xl bg-white p-5 text-ink">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">বাংলা</p>
            <p className="mt-3 text-sm leading-relaxed">
              ছোট ব্যবসার টিপ: প্রতিটি কমেন্টের উত্তর ২৪ ঘণ্টার মধ্যে দিন। এতে ক্রেতারা বোঝেন আপনি
              শুনছেন, আর আলোচনাটাও চলতে থাকে।
            </p>
          </article>
          <p className="text-xs text-ink-400 sm:col-span-2">Illustrative examples.</p>
        </div>
      </div>
    </section>
  );
}
