import { FinalCta } from "@/components/marketing/cta";
import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { LifetimeDealStrip } from "@/components/marketing/lifetime-deal";
import { PostFormats } from "@/components/marketing/post-formats";
import { getSitePage } from "@/lib/data/site-pages";
import { normalizeHome } from "@/lib/home-content";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationLd } from "@/lib/seo";
import { loadLifetimeOffer } from "@/lib/services/lifetime-deal";
import { loadSeo, pageMetadata, siteBase } from "@/lib/services/seo";

export async function generateMetadata() {
  return pageMetadata("/");
}

// The words come from Admin -> Pages -> Home page (or the built-in text), so the page is built on request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const content = normalizeHome((await getSitePage("home"))?.data);
  const [{ settings }, offer] = await Promise.all([loadSeo(), loadLifetimeOffer()]);
  return (
    <>
      <JsonLd data={organizationLd(siteBase(), settings)} />
      <Hero content={content.hero} />
      {offer ? <LifetimeDealStrip offer={offer} /> : null}
      <HowItWorks content={content.how} />
      <Features content={content.features} />
      <PostFormats />
      <Faq content={content.faq} />
      <FinalCta content={content.cta} />
    </>
  );
}
