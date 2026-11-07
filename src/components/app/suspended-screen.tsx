import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";
import { Logo } from "@/components/brand/logo";

/** Shown instead of the signed-in app while an admin has suspended the account. */
export function SuspendedScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
      <main id="main-content" tabIndex={-1} className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-card outline-none">
        <Logo className="mx-auto h-8" />
        <span className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-extrabold">Your account is suspended</h1>
        <p className="mt-2 text-ink-600">You cannot use LazyAI right now. Your content has not been deleted.</p>
        <p className="mt-2 text-ink-600">If you think this is a mistake, write to us and we will look into it.</p>
        <Link href="/contact" className="mt-6 inline-block text-sm font-semibold text-brand underline underline-offset-2">
          Contact support
        </Link>
        <form action={signOutAction} className="mt-4">
          <button type="submit" className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-100">
            Sign out
          </button>
        </form>
      </main>
    </div>
  );
}
