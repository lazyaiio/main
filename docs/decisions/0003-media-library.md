# ADR 0003: Media library on private Supabase Storage

Status: accepted (Batch 7)

## Context
Posts need images. Uploads must be safe (no scripts, no look-alike files), private to a workspace, cheap on free tiers, and later publishable to Facebook (Batch 8/9).

## Decision
- One **private** bucket `media`. Files are named `<workspace id>/<random id>.<jpg|png|webp|gif>`; user file names are never used. Storage policies read the workspace id from the path, so members can read their own files and only owners/admins/editors can add or remove files. Images are shown through 10-minute signed links created on the server.
- Uploads go through a server action (limit 4 MB, below Vercel's 4.5 MB body limit). The server checks the real bytes: JPEG, PNG, WebP, or GIF only; the browser's claimed type and the file name must agree; size and pixel dimensions are limited (8,000 px). SVG and everything else are refused (they can carry scripts). No image library is needed.
- Library entries are created only by `register_media_asset()` (SECURITY DEFINER). It checks that the file really exists in the caller's workspace folder, validates the metadata, and enforces a free-tier guard of 100 files and 200 MB per workspace. Browsers can no longer insert `media_assets` rows directly, and one file can have only one entry.
- One image per post for now (the table supports more). Changing the image of an approved post moves it back to Draft.
- Stock photos use an `ImageSearchProvider` interface with one adapter (Pexels, `docs/MEDIA_PROVIDERS.md`). The browser sends only a numeric photo id; the server looks it up again, downloads from the provider's own host over HTTPS with a size limit and no redirects, and inspects the bytes like any upload.
- Usage records may use the `image.` prefix (searches and imports) for per-user hourly limits.

## Consequences
- Deleting an image removes it from every post that uses it. Batch 8/9 must handle scheduled posts whose image disappeared.
- EXIF data (such as GPS location) is not stripped from uploads yet; Facebook removes it on its side. Stripping can be added with an image library later.
- Orphan files can remain if a delete or registration fails midway; they are private and unlisted. A cleanup job can come with Batch 9.
- Supabase blocks direct SQL deletes from storage tables, so file removal is covered by the app flow, not the SQL test.
