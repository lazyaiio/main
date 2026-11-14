import "server-only";
import { getDb } from "@/lib/data/db";
import { isLiveFlagOn } from "@/lib/data/platform";
import { effectiveAppUrl } from "@/lib/deployment-checks";
import { contactEmail } from "@/lib/legal";
import { PUBLIC_PAGE_PROBES, judgePage, metaChecks, type MetaCheck, type MetaFacts, type ProbeOutcome } from "@/lib/meta-review";
import { getCronSecret, getMetaAppSecret, getRedirectUri, getSocialMode, getTokenEncryptionKey, isInsightsRequested } from "@/lib/social/keys";

export async function collectMetaFacts(): Promise<{ appUrl: string; checks: MetaCheck[] }> {
  const env = process.env as Record<string, string | undefined>;
  const appUrl = effectiveAppUrl(env);
  const db = await getDb();
  const facts: MetaFacts = {
    appIdSet: Boolean(env.META_APP_ID?.trim()),
    appSecretSet: getMetaAppSecret() !== null,
    tokenKeySet: getTokenEncryptionKey() !== null,
    redirectUriMatches: getRedirectUri() === `${appUrl}/api/meta/callback`,
    contactEmailSet: contactEmail() !== null,
    operatorNameSet: Boolean(env.NEXT_PUBLIC_OPERATOR_NAME?.trim()),
    operatorCountrySet: Boolean(env.NEXT_PUBLIC_OPERATOR_COUNTRY?.trim()),
    mock: getSocialMode() === "mock",
    liveFlagOn: await isLiveFlagOn(db).catch(() => false),
    cronReady: getCronSecret() !== null,
    isHttps: appUrl.startsWith("https://"),
    insightsOn: isInsightsRequested(),
  };
  return { appUrl, checks: metaChecks(facts) };
}

/** Opens the public pages Meta's reviewer will open, the way a visitor would. A page that cannot be fetched is "unknown", never a failure. */
export async function probePublicPages(appUrl: string): Promise<ProbeOutcome[]> {
  const email = contactEmail();
  return Promise.all(
    PUBLIC_PAGE_PROBES.map(async (probe) => {
      try {
        const res = await fetch(`${appUrl}${probe.path}`, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(6000) });
        return judgePage(probe, res.status, (await res.text()).slice(0, 300_000), email);
      } catch {
        return judgePage(probe, null, "", email);
      }
    }),
  );
}
