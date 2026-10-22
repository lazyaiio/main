import { FinalCta } from "@/components/marketing/cta";
import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PostFormats } from "@/components/marketing/post-formats";

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <PostFormats />
      <Faq />
      <FinalCta />
    </>
  );
}
