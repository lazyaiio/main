import { attachImageAction, deleteMediaAction, updateMediaAction } from "@/app/app/media/actions";
import { Field } from "@/components/auth/fields";
import { PendingButton } from "@/components/ui/pending-button";
import { MAX_ALT_LENGTH, MAX_CREDIT_LENGTH, formatBytes } from "@/lib/media/limits";
import type { MediaItem } from "@/lib/services/media";

/**
 * The library as small square thumbnails (many fit on one screen). Click a thumbnail to open the
 * full-size image in a new tab. In "attach" mode every tile has a button that adds it to a post.
 */
export function MediaGrid({ items, canEdit, attachTo }: { items: MediaItem[]; canEdit: boolean; attachTo?: string }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
      {items.map((item) => {
        const credit = item.attribution.credit_text;
        const label = item.alt_text ?? "No alt text";
        return (
          <li key={item.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card">
            {item.thumbUrl ? (
              <a
                href={item.url ?? item.thumbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                aria-label={`Open full-size image: ${label}`}
              >
                {/* Signed, short-lived links are not compatible with the Next.js image optimizer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumbUrl} alt={item.alt_text ?? ""} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </a>
            ) : (
              <div className="flex aspect-square items-center justify-center bg-ink-50 px-2 text-center text-[11px] text-ink-500">Preview unavailable</div>
            )}

            <div className="flex flex-1 flex-col gap-2 p-2.5">
              <p className="truncate text-xs text-ink-700" title={item.alt_text ?? undefined}>
                {item.alt_text ? item.alt_text : <span className="text-amber-700">No alt text</span>}
              </p>
              <p className="truncate text-[11px] text-ink-500" title={credit ?? undefined}>
                {item.width} × {item.height} · {formatBytes(item.byte_size ?? 0)}
              </p>

              {attachTo && canEdit ? (
                <form action={attachImageAction}>
                  <input type="hidden" name="itemId" value={attachTo} />
                  <input type="hidden" name="mediaId" value={item.id} />
                  <PendingButton variant="primary" pendingLabel="Adding…">
                    Use
                  </PendingButton>
                </form>
              ) : null}

              {canEdit ? (
                <div className="mt-auto space-y-1.5">
                  <details className="rounded-lg border border-ink-100 px-2 py-1.5 text-xs">
                    <summary className="cursor-pointer font-medium text-ink-700">Edit</summary>
                    <form action={updateMediaAction} className="mt-2 space-y-2">
                      <input type="hidden" name="mediaId" value={item.id} />
                      <Field label="Alt text" name={`altText-${item.id}`} maxLength={MAX_ALT_LENGTH} defaultValue={item.alt_text ?? ""} />
                      <Field label="Credit" name={`credit-${item.id}`} maxLength={MAX_CREDIT_LENGTH} defaultValue={credit ?? ""} />
                      <PendingButton pendingLabel="Saving…">Save</PendingButton>
                    </form>
                  </details>
                  <details className="rounded-lg border border-ink-100 px-2 py-1.5 text-xs">
                    <summary className="cursor-pointer font-medium text-red-700">Delete</summary>
                    <form action={deleteMediaAction} className="mt-2 space-y-2">
                      <input type="hidden" name="mediaId" value={item.id} />
                      <p className="text-ink-600">This removes the image from your library and from any post that uses it. It cannot be undone.</p>
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
