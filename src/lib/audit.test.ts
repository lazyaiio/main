import { describe, expect, it } from "vitest";
import { describeAuditEvent } from "./audit";

describe("describeAuditEvent", () => {
  it("describes known actions with the entity name", () => {
    expect(describeAuditEvent({ action: "project.created", metadata: { name: "Shop tips" } })).toBe(
      "Created project “Shop tips”",
    );
  });

  it("falls back gracefully", () => {
    expect(describeAuditEvent({ action: "post.published", metadata: {} })).toBe("post published");
  });
});
