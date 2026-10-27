import type { Metadata } from "next";
import { updateSettingsAction } from "@/app/app/actions";
import { signOutAction } from "@/app/auth/actions";
import { DeleteAccountForm } from "@/components/app/delete-account-form";
import { EmailPreferencesForm } from "@/components/app/email-preferences-form";
import { PlanUsageCard } from "@/components/app/plan-usage-card";
import { ProfileForm } from "@/components/app/profile-form";
import { Button } from "@/components/ui/button";
import { getAppContext } from "@/lib/auth/session";
import { getDb } from "@/lib/data/db";
import { getOwnPrefs } from "@/lib/data/email";
import { getPlanOverview } from "@/lib/services/plans";
import { getTimeZoneOptions } from "@/lib/timezones";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await getAppContext();
  if (!ctx) return null;
  const prefs = await getOwnPrefs(await getDb(), ctx.user.id).catch(() => ({ campaign_complete: true, publish_failures: true, page_alerts: true, suppressed: false }));

  const plan = await getPlanOverview(ctx).catch(() => null);

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

      {plan ? (
        <section className="max-w-xl rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <h2 className="font-display text-lg font-bold">Plan and usage</h2>
          <div className="mt-4">
            <PlanUsageCard overview={plan} />
          </div>
        </section>
      ) : null}

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

      <section className="max-w-xl rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Your data</h2>
        <p className="mt-2 text-sm text-ink-600">
          Download a copy of your workspace content, schedules, and activity as a JSON file. Passwords, Facebook access tokens, and image files are not included.
          You can download up to 5 times a day.
        </p>
        <p className="mt-4">
          <a href="/api/account/export" download className="inline-flex h-11 items-center rounded-xl border border-ink-200 bg-white px-5 text-sm font-semibold text-ink hover:bg-ink-50">
            Download my data
          </a>
        </p>
      </section>

      <section className="max-w-xl rounded-2xl border border-red-200 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold text-red-700">Delete my account</h2>
        <p className="mt-2 text-sm text-ink-600">
          This permanently deletes your account, your workspace, all posts, campaigns, schedules, images, and your Facebook connections (the saved access is erased).
          Posts that were already published on Facebook stay on Facebook. This cannot be undone. Download your data first if you want a copy. If your workspace
          has other members, remove them before you delete the account.
        </p>
        <div className="mt-4">
          <DeleteAccountForm />
        </div>
      </section>
    </div>
  );
}
