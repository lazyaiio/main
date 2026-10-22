import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { hasApiKey } from "@/lib/ai/keys";
import { PROVIDERS } from "@/lib/ai/registry";
import { listProviderSettings } from "@/lib/data/ai-settings";
import { getDb } from "@/lib/data/db";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const settings = await listProviderSettings(await getDb());
  const anyKey = settings.some((s) => hasApiKey(s.provider));
  const anyReady = settings.some((s) => s.enabled && hasApiKey(s.provider));

  const steps = [
    { label: "Add an API key", detail: "In your hosting environment variables, then redeploy.", done: anyKey, href: "/admin/ai-providers" },
    { label: "Turn on a provider", detail: "Pick the model and the order of use.", done: anyReady, href: "/admin/ai-providers" },
    { label: "Write a test post", detail: "Create a post and check the quality.", done: false, href: "/app/content/new" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Admin overview" description="Set up and manage the product behind the scenes." />

      <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Set up AI writing</h2>
        <ol className="mt-4 divide-y divide-ink-100">
          {steps.map((step, index) => (
            <li key={step.label} className="flex items-center justify-between gap-4 py-3.5">
              <div className="flex min-w-0 items-center gap-3">
                {step.done ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true" />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-600">
                    {index + 1}
                  </span>
                )}
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold", step.done && "text-ink-500")}>{step.label}</p>
                  <p className="text-xs text-ink-500">{step.detail}</p>
                </div>
              </div>
              {!step.done ? (
                <Link href={step.href} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand hover:underline">
                  Open <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <Badge tone="green">Done</Badge>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Providers</h2>
          <Link href="/admin/ai-providers" className="text-sm font-semibold text-brand hover:underline">
            Manage
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-ink-100">
          {settings.map((row) => (
            <li key={row.provider} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{PROVIDERS[row.provider].label}</p>
                <p className="truncate text-xs text-ink-500">{row.model}</p>
              </div>
              <div className="flex gap-2">
                <Badge tone={hasApiKey(row.provider) ? "green" : "neutral"}>
                  {hasApiKey(row.provider) ? "Key found" : "No key"}
                </Badge>
                <Badge tone={row.enabled ? "brand" : "neutral"}>{row.enabled ? "On" : "Off"}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
