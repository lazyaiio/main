import Link from "next/link";
import { Wrench } from "lucide-react";
import { Logo } from "@/components/brand/logo";

/** Shown instead of the signed-in app while an admin has maintenance mode on. */
export function MaintenanceScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
      <main id="main-content" tabIndex={-1} className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-card outline-none">
        <Logo className="mx-auto h-8" />
        <span className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          <Wrench className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-extrabold">We will be right back</h1>
        <p className="mt-2 text-ink-600">{message}</p>
        <p className="mt-6 text-sm text-ink-500">Posts that are already scheduled are not lost.</p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-brand underline underline-offset-2">
          Back to the website
        </Link>
      </main>
    </div>
  );
}
