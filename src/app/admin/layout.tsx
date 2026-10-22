import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · LazyAI" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-ink-50 md:grid md:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-ink-100 bg-white p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <Link href="/admin" aria-label="Admin overview">
            <Logo className="h-7" />
          </Link>
          <Badge tone="brand">Admin</Badge>
        </div>
        <AdminNav orientation="vertical" />
        <div className="mt-auto space-y-3 rounded-xl bg-ink-50 p-3">
          <p className="truncate text-xs text-ink-500">{ctx.user.email}</p>
          <Link
            href="/app"
            className="flex items-center gap-2 text-sm font-medium text-ink-700 hover:text-brand"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the app
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="border-b border-ink-100 bg-white pt-3 md:hidden">
          <div className="mb-3 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Logo className="h-6" />
              <Badge tone="brand">Admin</Badge>
            </div>
            <Link href="/app" className="text-sm font-medium text-ink-600">
              Back to app
            </Link>
          </div>
          <AdminNav orientation="horizontal" />
        </div>
        <main className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}
