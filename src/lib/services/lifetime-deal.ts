import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { getBillingCurrency, listVisiblePlans } from "@/lib/data/plans";
import { closeLifetimeSales, readLifetimeDeal, writeLifetimeDeal } from "@/lib/data/lifetime-deal";
import { isDealOver, buildOffer, type LifetimeDeal, type LifetimeOffer } from "@/lib/lifetime-deal";
import { logInfo } from "@/lib/log";

export const OFFER_TAG = "lifetime-offer";

const cachedOffer = unstable_cache(
  async (): Promise<LifetimeOffer | null> => {
    const deal = await readLifetimeDeal();
    if (!deal.enabled) return null;
    const [plans, currency] = await Promise.all([listVisiblePlans(), getBillingCurrency()]);
    return buildOffer(deal, plans, currency);
  },
  ["lifetime-offer"],
  { revalidate: 60, tags: [OFFER_TAG] },
);

/** What the public site shows (cached for a minute). Never throws: a problem means "no deal is shown". */
export async function loadLifetimeOffer(): Promise<LifetimeOffer | null> {
  try {
    return await cachedOffer();
  } catch {
    return null;
  }
}

export function refreshLifetimeOffer(): void {
  try {
    revalidateTag(OFFER_TAG);
  } catch {
    // Outside a request the cache simply expires on its own within a minute.
  }
}

export async function saveLifetimeDeal(deal: LifetimeDeal, userId: string): Promise<void> {
  await writeLifetimeDeal(deal, userId);
  refreshLifetimeOffer();
}

/** Called by the scheduler: when the end date has passed, lifetime sales really stop and the deal switches itself off. */
export async function closeEndedLifetimeDeal(): Promise<boolean> {
  const deal = await readLifetimeDeal();
  if (!deal.enabled || !isDealOver(deal)) return false;
  const closed = await closeLifetimeSales();
  await writeLifetimeDeal({ ...deal, enabled: false }, null).catch(() => undefined);
  refreshLifetimeOffer();
  logInfo("lifetime_deal.closed", { plans: closed });
  return true;
}
