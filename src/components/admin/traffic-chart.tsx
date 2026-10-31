import { bucketLabel, type Bucket, type SeriesPoint } from "@/lib/analytics";

/** Bars for page views with the visitors drawn as a darker bar inside. Plain HTML, no chart library. */
export function TrafficChart({ points, bucket }: { points: SeriesPoint[]; bucket: Bucket }) {
  const max = Math.max(1, ...points.map((p) => p.views));
  const every = Math.max(1, Math.ceil(points.length / 8));
  return (
    <figure>
      <div role="img" aria-label={`Page views and visitors, ${points.length} ${bucket}s. Details are in the table below.`} className="flex h-48 items-end gap-px">
        {points.map((p) => (
          <div key={p.t} className="group relative flex h-full min-w-0 flex-1 items-end" title={`${bucketLabel(p.t, bucket)}: ${p.views} views, ${p.visitors} visitors`}>
            <div className="relative w-full rounded-t bg-brand-200" style={{ height: `${Math.max(p.views > 0 ? 2 : 0, (p.views / max) * 100)}%` }}>
              <div className="absolute bottom-0 w-full rounded-t bg-brand" style={{ height: `${p.views > 0 ? Math.min(100, (p.visitors / p.views) * 100) : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex text-[11px] text-ink-500" aria-hidden="true">
        {points.map((p, i) => (
          <span key={p.t} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
            {i % every === 0 ? bucketLabel(p.t, bucket) : ""}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-4 text-xs text-ink-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-200" /> Page views
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand" /> Visitors (share of views)
        </span>
      </figcaption>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-brand">Show the numbers</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="py-1.5 pr-4">{bucket === "hour" ? "Hour (UTC)" : "Period"}</th>
                <th className="py-1.5 pr-4">Visitors</th>
                <th className="py-1.5 pr-4">Sessions</th>
                <th className="py-1.5">Page views</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {[...points].reverse().map((p) => (
                <tr key={p.t}>
                  <td className="py-1.5 pr-4">{bucketLabel(p.t, bucket)}</td>
                  <td className="py-1.5 pr-4">{p.visitors.toLocaleString("en-US")}</td>
                  <td className="py-1.5 pr-4">{p.sessions.toLocaleString("en-US")}</td>
                  <td className="py-1.5">{p.views.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
