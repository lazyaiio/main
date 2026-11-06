import type { Metadata } from "next";
import { pageMetadata } from "@/lib/services/seo";
import { ContactForm } from "@/components/marketing/contact-form";
import { SitePage } from "@/components/marketing/site-page";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/contact");
}

// The text comes from Admin -> Pages (or the built-in text), so the page is built on request.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <SitePage slug="contact" showUpdated={false} />
      <section aria-labelledby="contact-form-title" className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card sm:p-8">
          <h2 id="contact-form-title" className="font-display text-2xl font-bold">
            Send us a message
          </h2>
          <p className="mt-1 mb-6 text-sm text-ink-600">We read every message. You can write in English or Bengali.</p>
          <ContactForm startedAt={Date.now()} />
        </div>
      </section>
    </>
  );
}
