import { deleteMediaAction, updateMediaAction, attachImageAction } from "@/app/app/media/actions";
import { Field } from "@/components/auth/fields";
import { PendingButton } from "@/components/ui/pending-button";
import type { MediaItem } from "@/lib/services/media";
import { MAX_ALT_LENGTH, MAX_CREDIT_LENGTH, formatBytes } from "@/lib/media/limits";

/** The images in the library. In "attach" mode every image has a button that adds it to a post. */
export function MediaGrid({ items, canEdit, attachTo }: { items: MediaItem[]; canEdit: boolean; attachTo?: string }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const credit = item.attribution.credit_text;
        return (
          <li key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
            <div className="flex aspect-[4/3] items-center justify-center bg-ink-50">
              {item.url ? (
                // Signed, short-lived links are not compatible with the Next.js image optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.alt_text ?? ""} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="px-4 text-center text-xs text-ink-500">Preview unavailable. Reload the page.</span>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-3 p-4">
              <div className="space-y-1 text-sm">
                <p className="text-ink-700">{item.alt_text ? item.alt_text : <span className="text-amber-700">No alt text yet</span>}</p>
                <p className="text-xs text-ink-500">
                  {item.width} × {item.height} · {formatBytes(item.byte_size ?? 0)}
                  {credit ? ` · ${credit}` : ""}
                </p>
              </div>

              {attachTo && canEdit ? (
                <form action={attachImageAction}>
                  <input type="hidden" name="itemId" value={attachTo} />
                  <input type="hidden" name="mediaId" value={item.id} />
                  <PendingButton variant="primary" pendingLabel="Adding…">
                    Use this image
                  </PendingButton>
                </form>
              ) : null}

              {canEdit ? (
                <div className="mt-auto space-y-2">
                  <details className="rounded-xl border border-ink-100 px-3 py-2 text-sm">
                    <summary className="cursor-pointer font-medium text-ink-700">Edit details</summary>
                    <form action={updateMediaAction} className="mt-3 space-y-3">
                      <input type="hidden" name="mediaId" value={item.id} />
                      <Field label="Alt text" name={`altText-${item.id}`} maxLength={MAX_ALT_LENGTH} defaultValue={item.alt_text ?? ""} />
                      <Field label="Credit or source" name={`credit-${item.id}`} maxLength={MAX_CREDIT_LENGTH} defaultValue={credit ?? ""} />
                      <PendingButton pendingLabel="Saving…">Save</PendingButton>
                    </form>
                  </details>
                  <details className="rounded-xl border border-ink-100 px-3 py-2 text-sm">
                    <summary className="cursor-pointer font-medium text-red-700">Delete</summary>
                    <form action={deleteMediaAction} className="mt-3 space-y-3">
                      <input type="hidden" name="mediaId" value={item.id} />
                      <p className="text-xs text-ink-600">
                        This removes the image from your library and from any post that uses it. This cannot be undone.
                      </p>
                      <PendingButton variant="ghost" pendingLabel="Deleting…">
                        Delete image
                      </PendingButton>
                    </form>
                  </details>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
