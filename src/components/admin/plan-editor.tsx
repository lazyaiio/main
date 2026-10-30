import { updatePlanAction } from "@/app/admin/plans/actions";
import { PendingButton } from "@/components/ui/pending-button";
import type { PlanRow } from "@/lib/data/plans";
import { LIMIT_KEYS, LIMIT_LABELS } from "@/lib/plans";

const input = "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";
const label = "block text-xs font-semibold uppercase tracking-wide text-ink-500";

/** One plan's editor: text, prices, feature list, flags and limits. Saves with a server action. */
export function PlanEditor({ plan, currency }: { plan: PlanRow; currency: string }) {
  return (
    <form action={updatePlanAction} className="space-y-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <input type="hidden" name="key" value={plan.key} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-bold">{plan.name}</h3>
        <p className="text-xs text-ink-500">Plan key: {plan.key}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}>
          Name
          <input name="name" required maxLength={60} defaultValue={plan.name} className={input} />
        </label>
        <label className={label}>
          Short description
          <input name="tagline" maxLength={160} defaultValue={plan.tagline} className={input} />
        </label>
        <label className={label}>
          Monthly price ({currency})
          <input name="priceMonthly" inputMode="decimal" defaultValue={plan.price_monthly ?? ""} placeholder="Leave empty if not set" className={input} />
        </label>
        <label className={label}>
          Yearly price ({currency})
          <input name="priceYearly" inputMode="decimal" defaultValue={plan.price_yearly ?? ""} placeholder="Optional" className={input} />
        </label>
        <label className={label}>
          Lifetime price ({currency}, one time)
          <input name="priceLifetime" inputMode="decimal" defaultValue={plan.price_lifetime ?? ""} placeholder="Optional" className={input} />
        </label>
      </div>

      <label className={label}>
        Features (one per line, up to 20)
        <textarea name="features" rows={6} defaultValue={plan.features.join("\n")} className={input} />
      </label>

      <div>
        <p className={label}>Limits (enforced by the server)</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LIMIT_KEYS.map((key) => {
            const raw = plan.limits[key];
            const value = typeof raw === "number" ? (key === "media_bytes" ? Math.round(raw / (1024 * 1024)) : raw) : "";
            return (
              <label key={key} className="block text-xs text-ink-600">
                {LIMIT_LABELS[key].label}
                {key === "media_bytes" ? " (MB)" : ""}
                <input name={`limit_${key}`} required inputMode="numeric" defaultValue={value} className={input} />
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-500">Every limit needs a number. For practically unlimited, type a very large number.</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="visible" defaultChecked={plan.visible} className="h-4 w-4 accent-brand" /> Show on the pricing page
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="lifetimeAvailable" defaultChecked={plan.lifetime_available} className="h-4 w-4 accent-brand" /> Offer the lifetime option now
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="highlighted" defaultChecked={plan.highlighted} className="h-4 w-4 accent-brand" /> Mark as most popular
        </label>
      </div>
      <PendingButton pendingLabel="Saving…">Save {plan.name}</PendingButton>
    </form>
  );
}
