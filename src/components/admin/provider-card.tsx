import { CheckCircle2, KeyRound } from "lucide-react";
import { ProviderSettingsForm, ProviderTestForm } from "@/components/admin/provider-forms";
import { Badge } from "@/components/ui/badge";
import { PROVIDERS } from "@/lib/ai/registry";
import type { ProviderId } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

const AVATARS: Record<ProviderId, string> = {
  anthropic: "bg-orange-100 text-orange-700",
  openai: "bg-emerald-100 text-emerald-700",
  gemini: "bg-blue-100 text-blue-700",
  openrouter: "bg-violet-100 text-violet-700",
};

export function ProviderCard({
  provider,
  enabled,
  model,
  priority,
  keyDetected,
}: {
  provider: ProviderId;
  enabled: boolean;
  model: string;
  priority: number;
  keyDetected: boolean;
}) {
  const info = PROVIDERS[provider];
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-base font-extrabold", AVATARS[provider])}
          >
            {info.label.charAt(0)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-bold">{info.label}</h2>
            <p className="text-sm text-ink-500">{info.note}</p>
          </div>
        </div>
        <Badge tone={enabled ? "green" : "neutral"}>{enabled ? "On" : "Off"}</Badge>
      </header>

      <div className="grid gap-6 p-5 md:grid-cols-[1fr_250px]">
        <ProviderSettingsForm provider={provider} enabled={enabled} model={model} priority={priority} keyDetected={keyDetected} />

        <aside className="space-y-4 rounded-xl bg-ink-50 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">API key</p>
            {keyDetected ? (
              <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Key found
              </p>
            ) : (
              <div className="mt-1.5 space-y-1.5 text-sm text-ink-600">
                <p className="flex items-center gap-2 font-medium text-amber-700">
                  <KeyRound className="h-4 w-4" aria-hidden="true" /> Not added yet
                </p>
                <p>
                  Add <code className="rounded bg-white px-1 py-0.5 text-xs">{info.envVar}</code> in your hosting
                  environment variables, then redeploy.
                </p>
              </div>
            )}
          </div>
          <ProviderTestForm provider={provider} disabled={!keyDetected} />
        </aside>
      </div>
    </section>
  );
}
