import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

const stats = [
  { label: "Connected Pages", value: 0 },
  { label: "Awaiting review", value: 0 },
  { label: "Scheduled", value: 0 },
  { label: "Published", value: 0 },
];

const steps = [
  "Connect a Facebook Page",
  "Create your first project",
  "Generate and review posts",
  "Schedule approved posts",
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-ink-600">Here is where your content work will live.</p>
      </div>

      <div
        role="status"
        className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700"
      >
        <strong className="font-semibold">Preview mode.</strong> Sign-in and real data are not
        connected yet, so everything below is empty.
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <p className="text-sm text-ink-500">{stat.label}</p>
            <p className="mt-2 font-display text-3xl font-extrabold">{stat.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Getting started</h2>
        <ol className="mt-4 divide-y divide-ink-100">
          {steps.map((step, i) => (
            <li key={step} className="flex items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-3 text-sm font-medium">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-600">
                  {i + 1}
                </span>
                {step}
              </span>
              <Badge>Coming soon</Badge>
            </li>
          ))}
        </ol>
        <div className="mt-5">
          <ButtonLink href="/" variant="secondary" size="sm">
            Back to website <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
