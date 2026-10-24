import { IMAGE_EXTENSIONS, MAX_IMAGE_SIDE, MAX_UPLOAD_BYTES } from "./limits";

/**
 * Checks an uploaded image by looking at its actual bytes, never at what the browser claims.
 * Only JPEG, PNG, WebP, and GIF pass. SVG, HTML, and anything else are refused, so a renamed file
 * cannot sneak in. Also reads the pixel size without any image library.
 */

export type ImageMime = keyof typeof IMAGE_EXTENSIONS;
export type ImageExt = (typeof IMAGE_EXTENSIONS)[ImageMime];

export type InspectFailure = {
  ok: false;
  code: "empty" | "too_large" | "unsupported" | "corrupt" | "too_big_dimensions" | "type_mismatch";
  message: string;
};
export type InspectResult = { ok: true; mime: ImageMime; ext: ImageExt; width: number; height: number } | InspectFailure;

const UNSUPPORTED = "That file type is not supported. Use a JPG, PNG, WebP, or GIF image.";

function fail(code: InspectFailure["code"], message: string): InspectFailure {
  return { ok: false, code, message };
}

const u16be = (b: Uint8Array, i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u16le = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const u32be = (b: Uint8Array, i: number) => (((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0)) >>> 0;

function ascii(b: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let i = start; i < start + length; i++) out += String.fromCharCode(b[i] ?? 0);
  return out;
}

function sniff(b: Uint8Array): ImageMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 6 && (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a")) return "image/gif";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  return null;
}

type Size = { width: number; height: number } | null;

function pngSize(b: Uint8Array): Size {
  if (b.length < 24 || ascii(b, 12, 4) !== "IHDR") return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

function gifSize(b: Uint8Array): Size {
  if (b.length < 10) return null;
  return { width: u16le(b, 6), height: u16le(b, 8) };
}

const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpegSize(b: Uint8Array): Size {
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return null;
    while (b[i] === 0xff) i++; // fill bytes
    const marker = b[i] ?? 0;
    i++;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue; // no length
    if (marker === 0xd9 || marker === 0xda) return null; // end of image or start of data: no size found
    const length = u16be(b, i);
    if (length < 2) return null;
    if (SOF_MARKERS.has(marker)) {
      if (i + 6 >= b.length) return null;
      return { height: u16be(b, i + 3), width: u16be(b, i + 5) };
    }
    i += length;
  }
  return null;
}

function webpSize(b: Uint8Array): Size {
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 ") {
    if (b.length < 30 || b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (b.length < 25 || b[20] !== 0x2f) return null;
    const b1 = b[21] ?? 0;
    const b2 = b[22] ?? 0;
    const b3 = b[23] ?? 0;
    const b4 = b[24] ?? 0;
    return { width: 1 + (b1 | ((b2 & 0x3f) << 8)), height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)) };
  }
  if (chunk === "VP8X") {
    if (b.length < 30) return null;
    const w = (b[24] ?? 0) | ((b[25] ?? 0) << 8) | ((b[26] ?? 0) << 16);
    const h = (b[27] ?? 0) | ((b[28] ?? 0) << 8) | ((b[29] ?? 0) << 16);
    return { width: w + 1, height: h + 1 };
  }
  return null;
}

function extensionOf(fileName: string): string | null {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(fileName.trim());
  return match?.[1] ? match[1].toLowerCase() : null;
}

export function inspectImage(bytes: Uint8Array, hint: { fileName?: string; declaredType?: string } = {}): InspectResult {
  if (bytes.length === 0) return fail("empty", "That file is empty.");
  if (bytes.length > MAX_UPLOAD_BYTES) return fail("too_large", "That image is larger than 4 MB. Choose a smaller file.");

  const mime = sniff(bytes);
  if (!mime) return fail("unsupported", UNSUPPORTED);
  const ext = IMAGE_EXTENSIONS[mime];

  // What the browser says must agree with what the file really is.
  const declared = (hint.declaredType ?? "").trim().toLowerCase();
  if (declared && declared !== "application/octet-stream") {
    const normalized = declared === "image/jpg" ? "image/jpeg" : declared;
    if (normalized !== mime) return fail("type_mismatch", "The file type does not match its content. Choose a real image file.");
  }
  const named = hint.fileName ? extensionOf(hint.fileName) : null;
  if (named) {
    const family = named === "jpeg" ? "jpg" : named;
    if (!["jpg", "png", "webp", "gif"].includes(family)) return fail("unsupported", UNSUPPORTED);
    if (family !== ext) return fail("type_mismatch", "The file name does not match its content. Choose a real image file.");
  }

  const size = mime === "image/png" ? pngSize(bytes) : mime === "image/gif" ? gifSize(bytes) : mime === "image/jpeg" ? jpegSize(bytes) : webpSize(bytes);
  if (!size || size.width < 1 || size.height < 1) return fail("corrupt", "That image could not be read. Try saving it again or choose another file.");
  if (size.width > MAX_IMAGE_SIDE || size.height > MAX_IMAGE_SIDE) {
    return fail("too_big_dimensions", `That image is larger than ${MAX_IMAGE_SIDE} pixels on one side. Resize it and try again.`);
  }
  return { ok: true, mime, ext, width: size.width, height: size.height };
}
