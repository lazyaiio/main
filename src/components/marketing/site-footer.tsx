import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <Logo className="h-7" />
          <p className="mt-3 text-sm text-ink-500">{siteConfig.tagline}</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {siteConfig.footer.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-ink-600 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-ink-100">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-ink-400 sm:px-6">
          © {new Date().getFullYear()} LazyAI. LazyAI is not affiliated with or endorsed by Meta.
        </p>
      </div>
    </footer>
  );
}
