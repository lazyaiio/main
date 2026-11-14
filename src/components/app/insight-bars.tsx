import type { Point } from "@/lib/insights";
import { formatCount } from "@/lib/insights";

/** A small bar chart with a text table behind it for screen readers. Colors alone never carry meaning. */
export function InsightBars({ label, points }: { label: string; points: Point[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const w = 280;
  const h = 56;
  const gap = 2;
  const bar = points.length > 0 ? (w - gap * (points.length - 1)) / points.length : w;
  return (
    <figure className="mt-3">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label}: daily numbers for the last ${points.length} days`} className="h-14 w-full text-brand">
        {points.map((p, i) => {
          const bh = p.value === 0 ? 1 : Math.max(2, (p.value / max) * (h - 2));
          return <rect key={p.date} x={i * (bar + gap)} y={h - bh} width={bar} height={bh} rx={1.5} fill="currentColor" opacity={p.value === 0 ? 0.25 : 0.9} />;
        })}
      </svg>
      <figcaption className="sr-only">
        {label} by day: {points.map((p) => `${p.date}: ${formatCount(p.value)}`).join(", ")}
      </figcaption>
    </figure>
  );
}
