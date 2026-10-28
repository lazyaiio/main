import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/app/profile-form";
import { Logo } from "@/components/brand/logo";
import { getAppContext } from "@/lib/auth/session";
import { getTimeZoneOptions } from "@/lib/timezones";
import { completeOnboardingAction } from "@/app/app/actions";

export const metadata: Metadata = { title: "Set up your workspace", robots: { index: false } };

export default async function OnboardingPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/auth/login");
  if (ctx.profile.onboarded_at) redirect("/app");

  return (
    <main id="main-content" tabIndex={-1} className="outline-none flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4 py-12">
      <Link href="/" aria-label="LazyAI home" className="mb-8 rounded-lg">
        <Logo className="h-9" priority />
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-8 shadow-soft">
        <h1 className="font-display text-2xl font-extrabold">Let’s set up your workspace</h1>
        <p className="mb-6 mt-1 text-sm text-ink-600">
          Four quick details. You can change them any time in Settings.
        </p>
        <ProfileForm
          action={completeOnboardingAction}
          submitLabel="Continue to dashboard"
          timezones={getTimeZoneOptions()}
          defaults={{
            displayName: ctx.profile.display_name,
            workspaceName: ctx.workspace.name,
            preferredLanguage: ctx.profile.preferred_language,
            timezone: ctx.profile.timezone,
          }}
        />
      </div>
    </main>
  );
}
