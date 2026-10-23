import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { describeSlotError } from "@/lib/campaign-failure";
import type { CampaignSlotRow } from "@/lib/data/types";
import { formatDateTime } from "@/lib/format";
import { formatLabel } from "@/lib/post-formats";
import { languageLabel } from "@/lib/projects";
import { slotStatus } from "@/lib/status";

/** The planned posts of a campaign with their status. Dates are shown in the workspace timezone. */
export function PlanTable({ slots, timeZone }: { slots: CampaignSlotRow[]; timeZone: string }) {
  return (
    <section aria-label="Planned posts" className="space-y-3">
      <h2 className="font-display text-lg font-bold">Planned posts</h2>
      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th scope="col" className="px-4 py-3">#</th>
              <th scope="col" className="px-4 py-3">When</th>
              <th scope="col" className="px-4 py-3">Language</th>
              <th scope="col" className="px-4 py-3">Format</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Post</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {slots.map((slot) => {
              const meta = slotStatus[slot.status];
              const problem = slot.status === "failed" || slot.status === "planned" ? describeSlotError(slot.last_error_code) : null;
              return (
                <tr key={slot.id}>
                  <td className="px-4 py-3 text-ink-500">{slot.slot_index + 1}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(slot.planned_at, timeZone)}</td>
                  <td className="px-4 py-3">{languageLabel(slot.language)}</td>
                  <td className="px-4 py-3">
                    {formatLabel(slot.content_format)}
                    {slot.theme ? <span className="block text-xs text-ink-500">{slot.theme}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {problem ? <span className="mt-1 block text-xs text-ink-500">{problem}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {slot.content_item_id ? (
                      <Link href={`/app/content/${slot.content_item_id}`} className="font-semibold text-brand hover:underline">
                        Open
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
