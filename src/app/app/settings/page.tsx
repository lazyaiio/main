import type { Metadata } from "next";
import { updateSettingsAction } from "@/app/app/actions";
import { signOutAction } from "@/app/auth/actions";
import { EmailPreferencesForm } from "@/components/app/email-preferences-form";
import { ProfileForm } from "@/components/app/profile-form";
import { Button } from "@/components/ui/button";
import { getAppContext } from "@/lib/auth/session";
import { getDb } from "@/lib/data/db";
import { getOwnPrefs } from "@/lib/data/email";
import { getTimeZoneOptions } from "@/lib/timezones";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await getAppContext();
  if (!ctx) return null;
  const prefs = await getOwnPrefs(await getDb(), ctx.user.id).catch(() => ({ campaign_complete: true, publish_failures: true, page_alerts: true, suppressed: false }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="mt-1 text-ink-600">Your profile and workspace.</p>
      </div>

      <section className="max-w-xl rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Profile and workspace</h2>
        <div className="mt-4">
          <ProfileForm
            action={updateSettingsAction}
            submitLabel="Save changes"
            timezones={getTimeZoneOptions()}
            defaults={{
              displayName: ctx.profile.display_name,
              workspaceName: ctx.workspace.name,
              preferredLanguage: ctx.profile.preferred_language,
              timezone: ctx.profile.timezone,
            }}
          />
        </div>
      </section>

      <section className="max-w-xl rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Email notifications</h2>
        <div className="mt-4">
          <EmailPreferencesForm prefs={prefs} />
        </div>
      </section>

      <section className="max-w-xl rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Account</h2>
        <p className="mt-2 text-sm text-ink-600">Signed in as {ctx.user.email}</p>
        <form action={signOutAction} className="mt-4">
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </section>
    </div>
  );
}
