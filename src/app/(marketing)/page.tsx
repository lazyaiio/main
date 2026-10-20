import { Bilingual } from "@/components/marketing/bilingual";
import { FinalCta } from "@/components/marketing/cta";
import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <Bilingual />
      <Faq />
      <FinalCta />
    </>
  );
}
