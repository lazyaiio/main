import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { ProviderCard } from "@/components/admin/provider-card";
import { PageHeader } from "@/components/ui/page-header";
import { hasApiKey, isMockEnabled } from "@/lib/ai/keys";
import { PROVIDERS } from "@/lib/ai/registry";
import { listProviderSettings } from "@/lib/data/ai-settings";
import { getDb } from "@/lib/data/db";

export const metadata: Metadata = { title: "AI providers" };

export default async function AiProvidersPage() {
  const settings = await listProviderSettings(await getDb());
  const active = settings.filter((s) => s.enabled && hasApiKey(s.provider)).sort((a, b) => a.priority - b.priority);
  const keysFound = settings.filter((s) => hasApiKey(s.provider)).length;

  return (
    <div className="space-y-6">
      <PageHeader title="AI providers" description="Choose which AI writes your posts. Turn providers on or off at any time." />

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <p className="text-sm text-ink-500">Providers on</p>
          <p className="mt-2 font-display text-3xl font-extrabold">{active.length}</p>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <p className="text-sm text-ink-500">API keys found</p>
          <p className="mt-2 font-display text-3xl font-extrabold">
            {keysFound}
            <span className="text-lg font-semibold text-ink-400"> / {settings.length}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <p className="text-sm text-ink-500">Test mode</p>
          <p className="mt-2 font-display text-3xl font-extrabold">{isMockEnabled() ? "On" : "Off"}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold">Order of use</h2>
        {active.length === 0 ? (
          <p className="mt-2 text-sm text-amber-700">
            No provider is ready. Posts cannot be written by AI until you add a key and turn one on.
          </p>
        ) : (
          <>
            <ol className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium">
              {active.map((row, index) => (
                <li key={row.provider} className="flex items-center gap-2">
                  {index > 0 ? <ChevronRight className="h-4 w-4 text-ink-300" aria-hidden="true" /> : null}
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-700">
                    {index + 1}. {PROVIDERS[row.provider].label}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-ink-500">
              The first provider is used. If it fails or is busy, the next one takes over.
            </p>
          </>
        )}
        {isMockEnabled() ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Test mode is on for this deployment, so sample text is used when no real provider is ready. It is never
            used in production.
          </p>
        ) : null}
      </section>

      <div className="space-y-4">
        {settings.map((row) => (
          <ProviderCard
            key={row.provider}
            provider={row.provider}
            enabled={row.enabled}
            model={row.model}
            priority={row.priority}
            keyDetected={hasApiKey(row.provider)}
          />
        ))}
      </div>

      <p className="text-xs text-ink-500">
        API keys are never saved in the database or shown here. Model names change often. If a test says the model name
        may be wrong, check the provider’s current model list and update the model above.
      </p>
    </div>
  );
}
