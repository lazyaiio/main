import "server-only";
import { getDb } from "@/lib/data/db";
import { readBkashSettings } from "@/lib/data/payments";
import { getHeartbeat, isLiveFlagOn } from "@/lib/data/platform";
import { listVisiblePlans } from "@/lib/data/plans";
import { listPublished } from "@/lib/data/blog";
import { getEmailSetup } from "@/lib/email/keys";
import { MIGRATION_PROBES, checkAppAddress, checkSettings, deploymentEnvironment, effectiveAppUrl, interpretProbe } from "@/lib/deployment-checks";
import type { LaunchFacts } from "@/lib/launch-checklist";
import { contactEmail, operatorCountry } from "@/lib/legal";
import { getCronSecret, getSocialSetup, isPublishingBlockedByEnv } from "@/lib/social/keys";

/** Reads everything the automatic checklist items need. Each part fails on its own into the safe answer ("not ready"). */
export async function collectLaunchFacts(requestHost: string | null): Promise<LaunchFacts> {
  const env = process.env as Record<string, string | undefined>;
  const db = await getDb();
  const deploy = [...checkAppAddress(env, requestHost), ...checkSettings(env)];

  const [probes, plans, bkash, liveFlagOn, heartbeat, blog] = await Promise.all([
    Promise.all(
      MIGRATION_PROBES.map(async ({ migration, table }) => {
        try {
          const { error } = await db.from(table).select("*", { head: true, count: "exact" }).limit(1);
          return { migration, result: interpretProbe(error) };
        } catch {
          return { migration, result: "unknown" as const };
        }
      }),
    ),
    listVisiblePlans().catch(() => []),
    readBkashSettings().catch(() => null),
    isLiveFlagOn(db).catch(() => false),
    getHeartbeat(db).catch(() => null),
    listPublished({ perPage: 1 }).catch(() => ({ posts: [], total: 0 })),
  ]);

  const email = getEmailSetup();
  const social = getSocialSetup();
  const credentialsSaved = Boolean(bkash?.appKey && bkash.appSecret && bkash.username && bkash.password);

  return {
    environment: deploymentEnvironment(env),
    appUrlIsHttps: effectiveAppUrl(env).startsWith("https://"),
    deployProblems: deploy.filter((c) => c.state === "bad").length,
    deployWarnings: deploy.filter((c) => c.state === "warn").length,
    missingMigrations: probes.filter((p) => p.result === "missing").map((p) => p.migration),
    contactEmailSet: contactEmail() !== null,
    operatorNameSet: Boolean(env.NEXT_PUBLIC_OPERATOR_NAME?.trim()),
    operatorCountrySet: operatorCountry() !== null,
    emailSendingReady: email.sendingReady,
    emailWebhookReady: email.webhookReady,
    paidPlansWithPrice: plans.filter((p) => p.key !== "free" && p.price_monthly !== null && p.price_monthly > 0).length,
    bkashReady: Boolean(bkash?.enabled) && credentialsSaved,
    bkashMode: bkash && credentialsSaved ? bkash.mode : null,
    socialMode: social.mode,
    socialReady: social.ready,
    liveFlagOn,
    publishingBlockedByEnv: isPublishingBlockedByEnv(),
    cronSecretSet: getCronSecret() !== null,
    heartbeatAgeMinutes: heartbeat ? (Date.now() - new Date(heartbeat.at).getTime()) / 60_000 : null,
    publishedBlogPosts: blog.total,
  };
}
