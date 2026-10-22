import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · LazyAI" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/app" aria-label="LazyAI dashboard">
              <Logo className="h-7" />
            </Link>
            <Badge tone="brand">Admin</Badge>
          </div>
          <nav aria-label="Admin" className="flex items-center gap-1 text-sm font-medium">
            <Link href="/admin/ai-providers" className="rounded-lg px-3 py-2 text-ink-700 hover:bg-ink-50">
              AI providers
            </Link>
            <Link href="/app" className="rounded-lg px-3 py-2 text-ink-500 hover:bg-ink-50">
              Back to app
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4 sm:p-6 md:p-10">{children}</main>
    </div>
  );
}
