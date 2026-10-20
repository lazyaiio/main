import { ButtonLink } from "@/components/ui/button";

export function PlaceholderPage({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { label: string; href: string };
}) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-600">{body}</p>
      {cta ? (
        <div className="mt-8 flex justify-center">
          <ButtonLink href={cta.href} variant="secondary">
            {cta.label}
          </ButtonLink>
        </div>
      ) : null}
    </section>
  );
}
