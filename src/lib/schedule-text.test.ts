import { describe, expect, it } from "vitest";
import { describeScheduleError, toLocalInputValue } from "./schedule-text";

describe("describeScheduleError", () => {
  it("explains every code the system stores, in plain English", () => {
    for (const code of [
      "uncertain_result", "missed_window", "not_approved", "post_missing", "page_missing", "page_disconnected", "token_missing", "token_unreadable",
      "rate_limited", "temporary", "image_download", "not_configured", "permission_missing", "token_expired", "page_access_lost", "content_rejected",
      "invalid_request", "unexpected", "something_new",
    ]) {
      expect(describeScheduleError(code)?.length).toBeGreaterThan(15);
    }
    expect(describeScheduleError(null)).toBeNull();
  });

  it("tells people an uncertain post will not be posted again on its own", () => {
    expect(describeScheduleError("uncertain_result")).toContain("will not post it again");
  });
});

describe("toLocalInputValue", () => {
  it("formats a UTC moment in the workspace timezone for a datetime-local input", () => {
    expect(toLocalInputValue("2026-11-02T04:00:00Z", "Asia/Dhaka")).toBe("2026-11-02T10:00");
    expect(toLocalInputValue("2026-11-02T15:00:00Z", "America/New_York")).toBe("2026-11-02T10:00");
    expect(toLocalInputValue("2026-11-02T00:05:00Z", "UTC")).toBe("2026-11-02T00:05");
  });
});
