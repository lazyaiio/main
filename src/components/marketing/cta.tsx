import { ArrowRight } from "lucide-react";
import type { HomeContent } from "@/lib/home-content";
import { ButtonLink } from "@/components/ui/button";

export function FinalCta({ content }: { content: HomeContent["cta"] }) {
  return (
    <section className="px-4 pb-16 sm:px-6 md:pb-24">
      <div className="mx-auto max-w-6xl rounded-3xl bg-brand px-6 py-12 text-center text-white sm:px-12 md:py-16">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {content.title}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-brand-100">
          {content.subtitle}
        </p>
        <div className="mt-8 flex justify-center">
          <ButtonLink href="/auth/signup" variant="light" size="lg">
            {content.button} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
