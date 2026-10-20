import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="LazyAI home" className="rounded-lg">
          <Logo priority />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink href="/auth/login" variant="ghost" size="sm">
            Log in
          </ButtonLink>
          <ButtonLink href="/auth/signup" size="sm">
            Start free
          </ButtonLink>
        </div>

        <details className="group relative md:hidden">
          <summary
            aria-label="Open menu"
            className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100 [&::-webkit-details-marker]:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 top-12 w-64 rounded-2xl border border-ink-100 bg-white p-2 shadow-soft">
            {siteConfig.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 grid gap-2 border-t border-ink-100 pt-3">
              <ButtonLink href="/auth/login" variant="secondary" size="sm">
                Log in
              </ButtonLink>
              <ButtonLink href="/auth/signup" size="sm">
                Start free
              </ButtonLink>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
