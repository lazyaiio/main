import type { Metadata } from "next";
import { StockProviderForm } from "@/components/admin/stock-provider-form";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { getStockStatus } from "@/lib/media/stock-providers";

export const metadata: Metadata = { title: "Stock photos" };
export const dynamic = "force-dynamic";

const INFO = {
  unsplash: { name: "Unsplash", signup: "https://unsplash.com/developers", note: "Free key (Access Key). A new app is limited to 50 requests per hour until Unsplash approves it for production." },
  pexels: { name: "Pexels", signup: "https://www.pexels.com/api/", note: "Free key, about 200 searches per hour. Photos are free for commercial use." },
  pixabay: { name: "Pixabay", signup: "https://pixabay.com/api/docs/", note: "Free key, 100 requests per minute. Photos are free for commercial use under the Pixabay Content License." },
} as const;

export default async function StockPhotosPage() {
  const status = await getStockStatus();
  const on = status.filter((s) => s.enabled).length;
  return (
    <div className="space-y-6">
      <PageHeader title="Stock photos" description="Free photos for posts. Add keys for Pixabay and Unsplash. Pexels is optional: add its key later when Pexels gives out keys again. Every provider that is on is searched at the same time and the results are mixed." />
      <p className="rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-700">
        {on > 0
          ? `${on} provider${on === 1 ? " is" : "s are"} on. Campaigns can add a photo to every post automatically, and people can search photos in Media.`
          : "No provider is on yet. Add a key below to turn on stock photos."}
      </p>
      <div className="space-y-4">
        {status.map((row) => (
          <section key={row.key} className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-bold">{INFO[row.key].name}</h2>
                <p className="text-sm text-ink-500">{INFO[row.key].note}</p>
              </div>
              <Badge tone={row.enabled ? "green" : "neutral"}>{row.enabled ? "On" : row.source === "none" ? "No key" : "Off"}</Badge>
            </header>
            <div className="grid gap-6 p-5 md:grid-cols-[1fr_260px]">
              <StockProviderForm provider={row.key} enabled={row.enabled} source={row.source} />
              <aside className="space-y-2 rounded-xl bg-ink-50 p-4 text-sm text-ink-600">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Get a key</p>
                <p>
                  Create a free account and copy the key from{" "}
                  <a href={INFO[row.key].signup} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">
                    {INFO[row.key].name}
                  </a>
                  .
                </p>
                <p className="text-xs text-ink-500">
                  Key source: {row.source === "admin" ? "saved here" : row.source === "environment" ? "Vercel environment variable" : "none"}.
                </p>
              </aside>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
