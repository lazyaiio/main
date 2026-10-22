import type { Metadata } from "next";
import { ProviderSettingsForm, ProviderTestForm } from "@/components/admin/provider-forms";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { hasApiKey, isMockEnabled } from "@/lib/ai/keys";
import { PROVIDERS } from "@/lib/ai/registry";
import { listProviderSettings } from "@/lib/data/ai-settings";
import { getDb } from "@/lib/data/db";

export const metadata: Metadata = { title: "AI providers" };

export default async function AiProvidersPage() {
  const settings = await listProviderSettings(await getDb());

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI providers"
        description="Turn providers on or off. LazyAI tries active providers from the lowest priority number up, and moves to the next one if a provider fails or is busy."
      />

      <div className="rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-700 shadow-card">
        API keys are never stored in the database or shown here. Add them as environment variables in your hosting
        dashboard (for example <code className="rounded bg-ink-100 px-1">ANTHROPIC_API_KEY</code>), redeploy, and the
        provider will show “Key found”.
      </div>

      {isMockEnabled() ? (
        <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Mock AI is on (AI_MOCK=1) for this deployment. It is used only when no real provider is active, and it is
          never used in production.
        </p>
      ) : null}

      <ul className="space-y-4">
        {settings.map((row) => {
          const info = PROVIDERS[row.provider];
          const keyDetected = hasApiKey(row.provider);
          return (
            <li key={row.provider} className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold">{info.label}</h2>
                  <p className="mt-1 text-sm text-ink-600">{info.note}</p>
                </div>
                <div className="flex gap-2">
                  <Badge tone={keyDetected ? "green" : "amber"}>{keyDetected ? "Key found" : "No key"}</Badge>
                  <Badge tone={row.enabled ? "brand" : "neutral"}>{row.enabled ? "Active" : "Inactive"}</Badge>
                </div>
              </div>
              {!keyDetected ? (
                <p className="mt-3 text-sm text-ink-600">
                  Environment variable needed: <code className="rounded bg-ink-100 px-1">{info.envVar}</code>
                </p>
              ) : null}

              <div className="mt-5 grid gap-6 md:grid-cols-[1fr_220px]">
                <ProviderSettingsForm
                  provider={row.provider}
                  enabled={row.enabled}
                  model={row.model}
                  priority={row.priority}
                  keyDetected={keyDetected}
                />
                <ProviderTestForm provider={row.provider} disabled={!keyDetected} />
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-ink-500">
        Model names change often. If a test fails with “model name may be wrong”, check the provider’s current model
        list and update the model here.
      </p>
    </div>
  );
}
