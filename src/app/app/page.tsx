import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getAppContext } from "@/lib/auth/session";

const done = ["Create your account", "Set up your workspace"];
const upcoming = [
  "Connect a Facebook Page",
  "Create your first project",
  "Generate and review posts",
  "Schedule approved posts",
];

export default async function DashboardPage() {
  const ctx = await getAppContext();
  const name = ctx?.profile.display_name || "there";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Welcome, {name}</h1>
        <p className="mt-1 text-ink-600">
          Your workspace “{ctx?.workspace.name}” is ready. Projects, campaigns, and publishing are
          being added step by step.
        </p>
      </div>

      <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Getting started</h2>
        <ul className="mt-4 divide-y divide-ink-100">
          {done.map((step) => (
            <li key={step} className="flex items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-3 text-sm font-medium">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                {step}
              </span>
              <Badge tone="green">Done</Badge>
            </li>
          ))}
          {upcoming.map((step, i) => (
            <li key={step} className="flex items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-3 text-sm font-medium">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-600">
                  {i + 3}
                </span>
                {step}
              </span>
              <Badge>Coming soon</Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
