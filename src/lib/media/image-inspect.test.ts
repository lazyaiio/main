import { describe, expect, it } from "vitest";
import { inspectImage } from "./image-inspect";
import { MAX_UPLOAD_BYTES } from "./limits";

const text = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le16 = (n: number) => [n & 255, (n >> 8) & 255];
const le32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];

function png(w: number, h: number) {
  return new Uint8Array([0x89, ...text("PNG"), 0x0d, 0x0a, 0x1a, 0x0a, ...be32(13), ...text("IHDR"), ...be32(w), ...be32(h), 8, 6, 0, 0, 0, 0, 0, 0, 0]);
}
function gif(w: number, h: number) {
  return new Uint8Array([...text("GIF89a"), ...le16(w), ...le16(h), 0, 0, 0]);
}
function jpeg(w: number, h: number) {
  // SOI, an APP0 segment to skip, then SOF0 with the size.
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...text("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0x00, 0x11, 8, (h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
}
function webpLossy(w: number, h: number) {
  return new Uint8Array([...text("RIFF"), ...le32(30), ...text("WEBP"), ...text("VP8 "), ...le32(10), 0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(w), ...le16(h)]);
}
function webpLossless(w: number, h: number) {
  const bits = (w - 1) | ((h - 1) << 14);
  return new Uint8Array([...text("RIFF"), ...le32(30), ...text("WEBP"), ...text("VP8L"), ...le32(5), 0x2f, bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >>> 24) & 255]);
}
function webpExtended(w: number, h: number) {
  const cw = w - 1;
  const ch = h - 1;
  return new Uint8Array([...text("RIFF"), ...le32(30), ...text("WEBP"), ...text("VP8X"), ...le32(10), 0, 0, 0, 0, cw & 255, (cw >> 8) & 255, (cw >> 16) & 255, ch & 255, (ch >> 8) & 255, (ch >> 16) & 255]);
}

describe("inspectImage", () => {
  it("reads PNG, GIF, JPEG, and WebP sizes from the bytes", () => {
    expect(inspectImage(png(800, 600))).toEqual({ ok: true, mime: "image/png", ext: "png", width: 800, height: 600 });
    expect(inspectImage(gif(320, 240))).toEqual({ ok: true, mime: "image/gif", ext: "gif", width: 320, height: 240 });
    expect(inspectImage(jpeg(1920, 1080))).toEqual({ ok: true, mime: "image/jpeg", ext: "jpg", width: 1920, height: 1080 });
    expect(inspectImage(webpLossy(640, 480))).toEqual({ ok: true, mime: "image/webp", ext: "webp", width: 640, height: 480 });
    expect(inspectImage(webpLossless(1200, 630))).toEqual({ ok: true, mime: "image/webp", ext: "webp", width: 1200, height: 630 });
    expect(inspectImage(webpExtended(1000, 500))).toEqual({ ok: true, mime: "image/webp", ext: "webp", width: 1000, height: 500 });
  });

  it("refuses files that are not images, even when renamed", () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(inspectImage(html, { fileName: "photo.png", declaredType: "image/png" })).toMatchObject({ ok: false, code: "unsupported" });
    expect(inspectImage(svg, { fileName: "logo.svg", declaredType: "image/svg+xml" })).toMatchObject({ ok: false, code: "unsupported" });
    expect(inspectImage(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toMatchObject({ ok: false, code: "unsupported" });
  });

  it("refuses empty and oversized files", () => {
    expect(inspectImage(new Uint8Array(0))).toMatchObject({ ok: false, code: "empty" });
    expect(inspectImage(new Uint8Array(MAX_UPLOAD_BYTES + 1))).toMatchObject({ ok: false, code: "too_large" });
  });

  it("refuses a name or declared type that disagrees with the content", () => {
    expect(inspectImage(png(10, 10), { fileName: "photo.jpg" })).toMatchObject({ ok: false, code: "type_mismatch" });
    expect(inspectImage(png(10, 10), { declaredType: "image/jpeg" })).toMatchObject({ ok: false, code: "type_mismatch" });
    expect(inspectImage(png(10, 10), { fileName: "photo.exe" })).toMatchObject({ ok: false, code: "unsupported" });
  });

  it("accepts matching hints, jpeg spelling variants, and generic types", () => {
    expect(inspectImage(jpeg(10, 10), { fileName: "Photo.JPEG", declaredType: "image/jpeg" }).ok).toBe(true);
    expect(inspectImage(jpeg(10, 10), { fileName: "photo.jpg", declaredType: "image/jpg" }).ok).toBe(true);
    expect(inspectImage(png(10, 10), { fileName: "noextension", declaredType: "application/octet-stream" }).ok).toBe(true);
  });

  it("refuses images that are too big in pixels or cut off", () => {
    expect(inspectImage(png(9000, 100))).toMatchObject({ ok: false, code: "too_big_dimensions" });
    expect(inspectImage(png(0, 100))).toMatchObject({ ok: false, code: "corrupt" });
    expect(inspectImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toMatchObject({ ok: false, code: "corrupt" });
    expect(inspectImage(png(10, 10).slice(0, 15))).toMatchObject({ ok: false, code: "corrupt" });
  });

  it("gives plain English messages", () => {
    const result = inspectImage(new Uint8Array([1, 2, 3, 4]));
    if (result.ok) throw new Error("expected failure");
    expect(result.message).toContain("JPG, PNG, WebP, or GIF");
  });
});
