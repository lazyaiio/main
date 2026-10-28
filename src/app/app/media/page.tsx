import type { Metadata } from "next";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { z } from "zod";
import { createThumbnailsAction, importStockPhotoAction } from "@/app/app/media/actions";
import { MediaGrid } from "@/components/media/media-grid";
import { UploadForm } from "@/components/media/upload-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PendingButton } from "@/components/ui/pending-button";
import { canWrite } from "@/lib/auth/permissions";
import { requireAppContext } from "@/lib/auth/session";
import type { StockPhoto } from "@/lib/media/image-search";
import { MEDIA_LIBRARY_MAX_BYTES, MEDIA_LIBRARY_MAX_FILES, formatBytes } from "@/lib/media/limits";
import { messageForCode } from "@/lib/service-messages";
import { ServiceError } from "@/lib/services/errors";
import { countMissingThumbnails, getStockProviderInfo, listLibrary, searchStockPhotos } from "@/lib/services/media";

export const metadata: Metadata = { title: "Media" };

// Creating thumbnails for older images can take a little while.
export const maxDuration = 60;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const NOTICES: Record<string, string> = {
  imported: "Photo added to your library.",
  updated: "Image details saved.",
  deleted: "Image deleted.",
  thumbs_done: "Thumbnails created for your older images.",
  thumbs_more: "Some thumbnails were created. Press the button again to continue.",
};

export default async function MediaPage({ searchParams }: Props) {
  const ctx = await requireAppContext();
  const sp = await searchParams;
  const writable = canWrite(ctx.role);

  const attach = z.string().uuid().safeParse(sp.attachTo);
  const attachTo = attach.success ? attach.data : undefined;
  const query = typeof sp.q === "string" ? sp.q : "";
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const error = messageForCode(sp.error);

  const [library, stock] = await Promise.all([listLibrary(ctx), Promise.resolve(getStockProviderInfo())]);

  let photos: StockPhoto[] = [];
  let searchError: string | null = null;
  if (stock && writable && query.trim()) {
    try {
      photos = await searchStockPhotos(ctx, query);
    } catch (e) {
      searchError = e instanceof ServiceError ? e.message : "Stock photo search failed. Please try again.";
    }
  }

  const { items, totalBytes } = library;
  const missingThumbs = countMissingThumbnails(items);

  return (
    <div className="space-y-8">
      {attachTo ? (
        <Link href={`/app/content/${attachTo}`} className="text-sm font-medium text-ink-500 hover:text-ink">
          ← Back to the post
        </Link>
      ) : null}

      <PageHeader
        title="Media"
        description={
          attachTo
            ? "Choose an image for your post, upload a new one, or find a free stock photo."
            : "Your images for posts. Files are private to your workspace."
        }
      />

      {notice ? (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {writable ? (
        <section aria-label="Upload" className="max-w-2xl space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <h2 className="font-display text-lg font-bold">Upload an image</h2>
          <UploadForm attachTo={attachTo} />
        </section>
      ) : null}

      {writable ? (
        <section aria-label="Stock photos" className="space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <h2 className="font-display text-lg font-bold">Find a free stock photo</h2>
          {stock ? (
            <>
              <form method="get" className="flex flex-wrap items-end gap-3">
                {attachTo ? <input type="hidden" name="attachTo" value={attachTo} /> : null}
                <div className="min-w-[14rem] flex-1 space-y-1.5">
                  <label htmlFor="stock-q" className="block text-sm font-medium text-ink-700">
                    Search
                  </label>
                  <input
                    id="stock-q"
                    name="q"
                    defaultValue={query}
                    maxLength={100}
                    placeholder="For example: coffee shop"
                    className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink placeholder:text-ink-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <PendingButton variant="secondary" pendingLabel="Searching…">
                  Search photos
                </PendingButton>
              </form>
              <p className="text-xs text-ink-500">
                Photos provided by{" "}
                <a href={stock.creditUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">
                  {stock.name}
                </a>
                . Free to use, including for business. Adding a photo saves a copy in your library with its credit.
              </p>

              {searchError ? (
                <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                  {searchError}
                </p>
              ) : null}
              {query.trim() && !searchError && photos.length === 0 ? (
                <p role="status" className="text-sm text-ink-600">
                  No photos found. Try different words.
                </p>
              ) : null}

              {photos.length > 0 ? (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {photos.map((photo) => (
                    <li key={photo.providerId} className="flex flex-col overflow-hidden rounded-xl border border-ink-100">
                      <div className="aspect-[4/3] bg-ink-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.previewUrl} alt={photo.alt} loading="lazy" className="h-full w-full object-cover" />
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-3 text-xs text-ink-600">
                        <p>
                          Photo by{" "}
                          {photo.creatorUrl ? (
                            <a href={photo.creatorUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink-700 hover:underline">
                              {photo.creator}
                            </a>
                          ) : (
                            photo.creator
                          )}{" "}
                          on{" "}
                          <a href={photo.sourcePageUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink-700 hover:underline">
                            {photo.providerName}
                          </a>
                        </p>
                        <form action={importStockPhotoAction} className="mt-auto">
                          <input type="hidden" name="photoId" value={photo.providerId} />
                          {attachTo ? <input type="hidden" name="attachTo" value={attachTo} /> : null}
                          <PendingButton variant="primary" pendingLabel="Adding…">
                            {attachTo ? "Use on this post" : "Add to library"}
                          </PendingButton>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-ink-600">
              Stock photo search is not set up yet. An admin can turn it on by adding a free Pexels API key (see the setup guide).
              Uploading your own images works without it.
            </p>
          )}
        </section>
      ) : null}

      <section aria-label="Library" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Your library</h2>
          <p className="text-sm text-ink-500">
            {items.length} of {MEDIA_LIBRARY_MAX_FILES} images · {formatBytes(totalBytes)} of {formatBytes(MEDIA_LIBRARY_MAX_BYTES)}
          </p>
        </div>
        {writable && missingThumbs > 0 ? (
          <form action={createThumbnailsAction} className="flex flex-wrap items-center gap-3 rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
            <p className="flex-1">
              {missingThumbs} older {missingThumbs === 1 ? "image has" : "images have"} no small preview yet, so {missingThumbs === 1 ? "it loads" : "they load"} at full size.
            </p>
            <PendingButton variant="secondary" pendingLabel="Creating…">
              Create thumbnails
            </PendingButton>
          </form>
        ) : null}
        {items.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="No images yet"
            body={writable ? "Upload an image or add a free stock photo above. Images you add here can be used on any post." : "Images added by your team will show up here."}
          />
        ) : (
          <MediaGrid items={items} canEdit={writable} attachTo={attachTo} />
        )}
      </section>
    </div>
  );
}
