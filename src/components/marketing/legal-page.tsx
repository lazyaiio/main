import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_UPDATED_AT, contactEmail, legalLinks } from "@/lib/legal";

/** Consistent layout for policy pages. Children use plain h2, h3, p, ul, and li elements. */
export function LegalPage({
  title,
  intro,
  children,
  updatedAt,
  toc,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
  /** Text after "Last updated:". Leave out for the built-in date; pass null to hide the line. */
  updatedAt?: string | null;
  toc?: { id: string; label: string }[];
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="border-b border-ink-100 pb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {updatedAt === null ? null : <p className="mt-3 text-sm text-ink-500">Last updated: {updatedAt ?? LEGAL_UPDATED_AT}</p>}
        {intro ? <p className="mt-4 text-lg leading-relaxed text-ink-600">{intro}</p> : null}
        {toc && toc.length > 0 ? (
          <nav aria-label="On this page" className="mt-6">
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {toc.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="font-medium text-brand underline underline-offset-2">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <div
        className="mt-2 text-base text-ink-700 [&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink [&_li]:mt-1.5 [&_li]:leading-relaxed [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_h2]:scroll-mt-24"
      >
        {children}
      </div>

      <nav aria-label="Other policies" className="mt-14 border-t border-ink-100 pt-6">
        <p className="text-sm font-semibold text-ink-700">Related pages</p>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          {legalLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="text-ink-600 underline underline-offset-2 hover:text-ink">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}

/** The contact address as a mail link, or a pointer to the Contact page until the address is configured. */
export function ContactEmail() {
  const email = contactEmail();
  if (!email) return <Link href="/contact">the contact details on our Contact page</Link>;
  return <a href={`mailto:${email}`}>{email}</a>;
}
