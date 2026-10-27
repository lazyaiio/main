import { describe, expect, it } from "vitest";
import { EXPORT_TABLES, MAX_EXPORT_ROWS, exportFileName, shapeExport, type ExportPart } from "./account-export";

describe("shapeExport", () => {
  it("keeps only the listed columns and never exports secrets, storage paths, or other columns", () => {
    const parts: Record<string, ExportPart> = {
      images: {
        rows: [{ id: "i1", alt_text: "A door", storage_path: "ws/abc.png", thumb_path: "ws/def.webp", byte_size: 10, secret_note: "x", attribution: { credit_text: "Me", access_token: "EAAB123" } }],
        truncated: false,
      },
      facebook_accounts: { rows: [{ id: "a1", display_name: "Jane", token_ciphertext: "v1.x.y.z", status: "connected", provider_account_id: "123" }], truncated: false },
    };
    const out = shapeExport(parts, { generatedAt: "2026-10-26T00:00:00Z" });
    const json = JSON.stringify(out);
    expect(json).not.toContain("storage_path");
    expect(json).not.toContain("ws/abc.png");
    expect(json).not.toContain("thumb_path");
    expect(json).not.toContain("token_ciphertext");
    expect(json).not.toContain("EAAB123");
    expect(json).not.toContain("provider_account_id");
    expect(json).not.toContain("secret_note");
    expect((out.data as Record<string, unknown>).images).toEqual([{ id: "i1", alt_text: "A door", byte_size: 10, attribution: { credit_text: "Me", access_token: "[redacted]" } }]);
  });

  it("has every table key, a single profile object, and notes where needed", () => {
    const out = shapeExport({ profile: { rows: [{ display_name: "Jane", created_at: "x" }], truncated: false } }, { generatedAt: "now" });
    const data = out.data as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(EXPORT_TABLES.map((t) => t.key));
    expect(data.profile).toEqual({ display_name: "Jane", created_at: "x" });
    expect(data.posts).toEqual([]);
    expect(out.notes.images).toContain("not included");
    expect(out.notes.facebook_accounts).toContain("never exported");
  });

  it("marks tables that hit the row limit", () => {
    const rows = Array.from({ length: MAX_EXPORT_ROWS + 1 }, (_, i) => ({ id: String(i), body: "x" }));
    const out = shapeExport({ posts: { rows, truncated: true } }, { generatedAt: "now" });
    expect(out.truncated).toEqual(["posts"]);
    expect((out.data as { posts: unknown[] }).posts).toHaveLength(MAX_EXPORT_ROWS);
  });

  it("no allow-list contains a secret-looking column", () => {
    for (const table of EXPORT_TABLES) {
      for (const column of table.columns) expect(column).not.toMatch(/(token|secret|password|ciphertext|cookie|storage_path|thumb_path)/i);
    }
  });

  it("names the file by date", () => {
    expect(exportFileName(new Date("2026-10-26T13:00:00Z"))).toBe("lazyai-export-2026-10-26.json");
  });
});
