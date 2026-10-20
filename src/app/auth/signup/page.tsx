import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/auth-forms";
import { NotConfigured } from "@/components/auth/not-configured";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Sign up", robots: { index: false } };

export default function SignupPage() {
  if (!isSupabaseConfigured()) return <NotConfigured />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Create your account</h1>
        <p className="mt-1 text-sm text-ink-600">Start planning and scheduling your posts.</p>
      </div>
      <SignupForm />
    </div>
  );
}
