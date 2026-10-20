import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AppNav } from "@/components/app/app-nav";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · LazyAI" },
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-50 md:grid md:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-ink-100 bg-white p-4 md:flex">
        <Link href="/app" aria-label="LazyAI dashboard" className="mb-6 px-2">
          <Logo className="h-7" />
        </Link>
        <AppNav orientation="vertical" />
        <div className="mt-auto rounded-xl bg-ink-50 p-3">
          <p className="text-xs font-semibold">Personal workspace</p>
          <p className="mt-0.5 text-xs text-ink-500">Timezone: Asia/Dhaka</p>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="border-b border-ink-100 bg-white pt-3 md:hidden">
          <Link href="/app" aria-label="LazyAI dashboard" className="mb-3 block px-4">
            <Logo className="h-6" />
          </Link>
          <AppNav orientation="horizontal" />
        </div>
        <main className="mx-auto max-w-5xl p-4 sm:p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}
