import { describe, expect, it } from "vitest";
import { classifyFailure, describeSlotError } from "./campaign-failure";

function named(name: string, extra: Record<string, unknown> = {}) {
  const error = new Error("x");
  error.name = name;
  return Object.assign(error, extra);
}

describe("classifyFailure", () => {
  it("stops the round when AI is not set up, without spending an attempt", () => {
    expect(classifyFailure(named("ServiceError", { kind: "not_configured" }))).toEqual({ code: "not_configured", retry: true, refund: true, stop: "not_configured" });
  });

  it("stops the round at the hourly limit", () => {
    expect(classifyFailure(named("ServiceError", { kind: "rate_limited" })).stop).toBe("rate_limited");
  });

  it("retries ordinary AI failures but counts the attempt", () => {
    expect(classifyFailure(named("ServiceError", { kind: "ai_failed" }))).toEqual({ code: "ai_failed", retry: true, refund: false, stop: null });
  });

  it("does not retry invalid settings", () => {
    expect(classifyFailure(named("ServiceError", { kind: "invalid" })).retry).toBe(false);
  });

  it("stops the round when the plan limit is reached", () => {
    expect(classifyFailure(named("DataError", { code: "53400" }))).toEqual({ code: "plan_limit", retry: true, refund: true, stop: "plan_limit" });
  });

  it("treats database errors and surprises as retryable", () => {
    expect(classifyFailure(named("DataError")).code).toBe("save_failed");
    expect(classifyFailure(new Error("???")).code).toBe("unexpected");
    expect(classifyFailure("string").retry).toBe(true);
  });
});

describe("describeSlotError", () => {
  it("returns friendly English text for every code the system stores", () => {
    for (const code of ["ai_failed", "duplicate", "timeout", "invalid_settings", "save_failed", "not_configured", "rate_limited", "plan_limit", "out_of_time", "other"]) {
      expect(describeSlotError(code)?.length).toBeGreaterThan(5);
    }
    expect(describeSlotError(null)).toBeNull();
  });
});
