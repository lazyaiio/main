import { percent } from "@/lib/analytics";
import type { NamedCount } from "@/lib/data/analytics";

/** A short ranked list with a bar behind each row. */
export function TopList({ title, rows, empty = "No data yet.", label }: { title: string; rows: NamedCount[]; empty?: string; label?: (row: NamedCount) => string }) {
  const total = rows.reduce((n, r) => n + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <h3 className="font-display text-base font-bold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={`${r.name}-${r.kind ?? ""}`} className="relative overflow-hidden rounded-lg">
              <div className="absolute inset-y-0 left-0 bg-brand-50" style={{ width: `${(r.count / max) * 100}%` }} aria-hidden="true" />
              <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5 text-sm">
                <span className="min-w-0 truncate text-ink-800" title={r.name}>
                  {label ? label(r) : r.name}
                </span>
                <span className="shrink-0 tabular-nums text-ink-600">
                  {r.count.toLocaleString("en-US")} <span className="text-xs text-ink-400">({percent(r.count, total)}%)</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
