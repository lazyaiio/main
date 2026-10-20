import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/auth-forms";
import { NotConfigured } from "@/components/auth/not-configured";
import { safeInternalPath } from "@/lib/auth/redirects";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  if (!isSupabaseConfigured()) return <NotConfigured />;

  const params = await searchParams;
  const next = safeInternalPath(params.next);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-600">Log in to your LazyAI workspace.</p>
      </div>
      {params.error === "callback" ? (
        <p role="alert" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-left text-sm text-amber-700">
          That link could not be completed. If you already confirmed your email, log in below.
          Otherwise, request a new link.
        </p>
      ) : null}
      <LoginForm next={next} />
    </div>
  );
}
