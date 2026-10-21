import { describe, expect, it } from "vitest";
import { excerpt, formatDateTime } from "./format";

describe("formatDateTime", () => {
  it("renders in the requested timezone", () => {
    expect(formatDateTime("2026-10-20T19:30:00Z", "Asia/Dhaka")).toContain("21 Oct 2026");
    expect(formatDateTime("2026-10-20T19:30:00Z", "UTC")).toContain("20 Oct 2026");
  });
});

describe("excerpt", () => {
  it("collapses whitespace and truncates with an ellipsis", () => {
    expect(excerpt("a   b\n c")).toBe("a b c");
    expect(excerpt("x".repeat(200), 10)).toBe(`${"x".repeat(9)}…`);
  });
});
