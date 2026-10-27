import { cn } from "@/lib/utils";
import type { PlanOverview } from "@/lib/services/plans";

/** Shows the workspace's plan and how much of each limit is used. */
export function PlanUsageCard({ overview }: { overview: PlanOverview }) {
  const name = overview.plan.charAt(0).toUpperCase() + overview.plan.slice(1);
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">
        Your workspace is on the <strong className="text-ink">{name}</strong> plan. Limits are checked on the server, so they apply everywhere in the app.
      </p>
      <ul className="space-y-4">
        {overview.rows.map((row) => (
          <li key={row.key}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-ink">{row.label}</p>
              <p className={cn("text-sm", row.atLimit ? "font-semibold text-red-700" : row.nearLimit ? "font-semibold text-amber-700" : "text-ink-600")}>
                {row.usedText} of {row.limitText}
              </p>
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100"
              role="progressbar"
              aria-label={row.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={row.percent ?? 0}
            >
              <div className={cn("h-full rounded-full", row.atLimit ? "bg-red-500" : row.nearLimit ? "bg-amber-500" : "bg-brand")} style={{ width: `${row.percent ?? 0}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-500">{row.hint}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-500">Need more? Contact us from the Contact page and we will raise your limits.</p>
    </div>
  );
}
