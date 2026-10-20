import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { NotConfigured } from "@/components/auth/not-configured";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  if (!isSupabaseConfigured()) return <NotConfigured />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Reset your password</h1>
        <p className="mt-1 text-sm text-ink-600">We will email you a link to choose a new one.</p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
