import { ImageIcon } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const queue: { when: string; title: string; status: string; tone: BadgeTone }[] = [
  { when: "Today · 9:00", title: "Tip: Reply to every comment", status: "Published", tone: "green" },
  { when: "Today · 20:00", title: "Myth vs fact: Big budget needed?", status: "Scheduled", tone: "brand" },
  { when: "Fri · 9:00", title: "Checklist: Your weekly routine", status: "Needs review", tone: "amber" },
  { when: "Fri · 20:00", title: "Story: A day in a small shop", status: "Draft", tone: "neutral" },
];

/** Static, illustrative preview. Not live data. */
export function ProductPreview() {
  return (
    <div className="relative">
      <div
        className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-100 via-white to-ink-100 blur-2xl"
        aria-hidden="true"
      />
      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <p className="truncate text-sm font-semibold">Digital Marketing for Small Businesses</p>
          <Badge tone="neutral">Sample preview</Badge>
        </div>

        <div className="grid md:grid-cols-5">
          <ul className="divide-y divide-ink-100 md:col-span-3 md:border-r md:border-ink-100">
            {queue.map((item) => (
              <li key={item.title} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink-500">{item.when}</p>
                  <p className="truncate text-sm font-medium">{item.title}</p>
                </div>
                <Badge tone={item.tone} className="shrink-0">
                  {item.status}
                </Badge>
              </li>
            ))}
          </ul>

          <div className="border-t border-ink-100 bg-ink-50 p-4 md:col-span-2 md:border-t-0">
            <div className="rounded-xl bg-white p-3 shadow-card">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                  L
                </span>
                <div>
                  <p className="text-xs font-semibold">Your Page</p>
                  <p className="text-[11px] text-ink-500">Tip</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed">
                Small business tip: reply to every comment within 24 hours.
              </p>
              <div className="mt-3 flex h-20 items-center justify-center rounded-lg bg-gradient-to-br from-brand-100 to-brand-50 text-brand-500">
                <ImageIcon className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="mt-3 flex gap-2">
                <span className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">
                  Approve
                </span>
                <span className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600">
                  Edit
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
