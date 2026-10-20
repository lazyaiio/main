import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4 py-12">
      <Link href="/" aria-label="LazyAI home" className="mb-8 rounded-lg">
        <Logo className="h-9" priority />
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-soft">
        {children}
      </div>
    </main>
  );
}
