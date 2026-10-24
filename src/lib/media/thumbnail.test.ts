import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { inspectImage } from "./image-inspect";
import { THUMB_MAX_SIDE, makeThumbnail } from "./thumbnail";

async function sample(width: number, height: number, format: "png" | "jpeg" | "gif" | "webp") {
  const base = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } } });
  const buffer = await base[format]().toBuffer();
  return new Uint8Array(buffer);
}

describe("makeThumbnail", () => {
  it("shrinks a large photo to a small WebP that passes the same image checks", async () => {
    const original = await sample(3000, 2000, "jpeg");
    const thumb = await makeThumbnail(original);
    expect(Math.max(thumb.width, thumb.height)).toBe(THUMB_MAX_SIDE);
    expect(thumb.width).toBe(480);
    expect(thumb.height).toBe(320);
    expect(thumb.bytes.length).toBeLessThan(original.length);
    const checked = inspectImage(thumb.bytes);
    expect(checked).toEqual({ ok: true, mime: "image/webp", ext: "webp", width: 480, height: 320 });
  });

  it("does not enlarge small images", async () => {
    const thumb = await makeThumbnail(await sample(100, 80, "png"));
    expect(thumb.width).toBe(100);
    expect(thumb.height).toBe(80);
  });

  it("handles tall images, GIF, and WebP input", async () => {
    const tall = await makeThumbnail(await sample(600, 1800, "png"));
    expect(tall.height).toBe(480);
    expect(tall.width).toBe(160);
    expect((await makeThumbnail(await sample(500, 500, "gif"))).width).toBe(480);
    expect((await makeThumbnail(await sample(500, 500, "webp"))).height).toBe(480);
  });

  it("applies camera rotation and leaves no metadata", async () => {
    const buffer = await sharp({ create: { width: 800, height: 400, channels: 3, background: { r: 10, g: 10, b: 10 } } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const thumb = await makeThumbnail(new Uint8Array(buffer));
    expect(thumb.width).toBe(240); // rotated: the 400-pixel side became the width
    expect(thumb.height).toBe(480);
    const meta = await sharp(Buffer.from(thumb.bytes)).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it("rejects bytes that are not an image", async () => {
    await expect(makeThumbnail(new Uint8Array([1, 2, 3, 4, 5]))).rejects.toBeInstanceOf(Error);
  });
});
