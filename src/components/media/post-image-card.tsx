import Link from "next/link";
import { detachImageAction } from "@/app/app/media/actions";
import { ButtonLink } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import type { MediaItem } from "@/lib/services/media";

/** The image on a post, with buttons to choose, upload, or remove it. One image per post for now. */
export function PostImageCard({ itemId, image, canEdit, imageBrief }: { itemId: string; image: MediaItem | null; canEdit: boolean; imageBrief: string | null }) {
  const chooseHref = `/app/media?attachTo=${itemId}`;
  return (
    <section aria-label="Image" className="max-w-2xl space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
      <h2 className="font-display text-lg font-bold">Image</h2>

      {image ? (
        <div className="flex flex-wrap items-start gap-4">
          <div className="h-32 w-44 shrink-0 overflow-hidden rounded-xl bg-ink-50">
            {image.url ? (
              // Signed, short-lived links are not compatible with the Next.js image optimizer.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.url} alt={image.alt_text ?? ""} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center px-3 text-center text-xs text-ink-500">Preview unavailable. Reload the page.</span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <p className="text-ink-700">{image.alt_text ? image.alt_text : <span className="text-amber-700">No alt text yet. You can add it in the library.</span>}</p>
            {image.attribution.credit_text ? <p className="text-xs text-ink-500">{image.attribution.credit_text}</p> : null}
            <p className="text-xs text-ink-500">
              <Link href="/app/media" className="font-semibold text-brand hover:underline">
                Open the library
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm text-ink-600">
          <p>No image yet. A post with a good photo usually gets more attention.</p>
          {imageBrief ? (
            <p className="rounded-xl bg-ink-50 px-3.5 py-2.5">
              <span className="font-medium text-ink-700">Image idea from the writer:</span> {imageBrief}
            </p>
          ) : null}
        </div>
      )}

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href={chooseHref} variant={image ? "secondary" : "primary"}>
            {image ? "Change image" : "Add an image"}
          </ButtonLink>
          {image ? (
            <form action={detachImageAction}>
              <input type="hidden" name="itemId" value={itemId} />
              <PendingButton variant="ghost" pendingLabel="Removing…">
                Remove image
              </PendingButton>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
