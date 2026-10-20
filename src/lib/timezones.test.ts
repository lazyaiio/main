import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEZONE, getTimeZoneOptions, isValidTimeZone } from "./timezones";

describe("timezones", () => {
  it("defaults to Asia/Dhaka and lists it", () => {
    expect(DEFAULT_TIMEZONE).toBe("Asia/Dhaka");
    expect(getTimeZoneOptions()).toContain("Asia/Dhaka");
  });

  it("validates IANA names", () => {
    expect(isValidTimeZone("Asia/Dhaka")).toBe(true);
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});
