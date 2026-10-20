import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { NotConfigured } from "@/components/auth/not-configured";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage() {
  if (!isSupabaseConfigured()) return <NotConfigured />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/forgot-password");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Choose a new password</h1>
        <p className="mt-1 text-sm text-ink-600">Use at least 8 characters.</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
