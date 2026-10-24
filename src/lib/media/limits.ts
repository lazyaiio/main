/** Limits for the media library. Mirrored by the database (migration 0006) and the storage bucket. */

/** Largest file accepted. Vercel allows request bodies up to 4.5 MB, so 4 MB leaves room for the form. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 8000;
export const MAX_ALT_LENGTH = 500;
export const MAX_CREDIT_LENGTH = 200;

export const MEDIA_LIBRARY_MAX_FILES = 100;
export const MEDIA_LIBRARY_MAX_BYTES = 200 * 1024 * 1024;

/** Per user and hour. Stock photo providers apply their own (shared) limits, so these stay low. */
export const STOCK_SEARCHES_PER_HOUR = 20;
export const STOCK_IMPORTS_PER_HOUR = 10;

export const IMAGE_EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" } as const;

/** Value for the file input's accept attribute. */
export const UPLOAD_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
