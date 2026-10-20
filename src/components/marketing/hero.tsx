import { ArrowRight, CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductPreview } from "./product-preview";

const reassurances = [
  "You review everything before it is scheduled",
  "You choose which Page LazyAI can use",
  "“Published” only appears after Facebook confirms it",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,theme(colors.brand.50),transparent)]"
        aria-hidden="true"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 md:pb-24 md:pt-20 lg:grid-cols-2">
        <div>
          <Badge tone="brand">Facebook Pages · English &amp; Bengali</Badge>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Work less. <span className="text-brand">Publish more.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
            Give LazyAI a topic or a website. Get a content plan, review the posts, and publish
            them on schedule — in English or Bengali.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/auth/signup" size="lg">
              Start free <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/#how" variant="secondary" size="lg">
              See how it works
            </ButtonLink>
          </div>
          <ul className="mt-8 space-y-2.5">
            {reassurances.map((text) => (
              <li key={text} className="flex items-start gap-2.5 text-sm text-ink-600">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}
