/**
 * Small preview images for the media library, so a library with many pictures stays light.
 * Server only (uses sharp). The result is a WebP of at most 480 pixels on the longest side, usually
 * 10 to 40 KB, upright (camera rotation applied) and without metadata such as GPS location.
 */

export const THUMB_MAX_SIDE = 480;
const THUMB_QUALITY = 78;
/** Refuse to decode anything larger than this many pixels (the upload check already caps 8,000 x 8,000). */
const MAX_INPUT_PIXELS = 64_000_000;

export type Thumbnail = { bytes: Uint8Array; width: number; height: number };

export async function makeThumbnail(input: Uint8Array): Promise<Thumbnail> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
    .rotate()
    .resize({ width: THUMB_MAX_SIDE, height: THUMB_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer({ resolveWithObject: true });
  return { bytes: new Uint8Array(data), width: info.width, height: info.height };
}
