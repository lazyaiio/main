import { FinalCta } from "@/components/marketing/cta";
import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PostFormats } from "@/components/marketing/post-formats";
import { getSitePage } from "@/lib/data/site-pages";
import { normalizeHome } from "@/lib/home-content";

// The words come from Admin -> Pages -> Home page (or the built-in text), so the page is built on request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const content = normalizeHome((await getSitePage("home"))?.data);
  return (
    <>
      <Hero content={content.hero} />
      <HowItWorks content={content.how} />
      <Features content={content.features} />
      <PostFormats />
      <Faq content={content.faq} />
      <FinalCta content={content.cta} />
    </>
  );
}
