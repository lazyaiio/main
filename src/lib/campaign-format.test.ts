import { describe, expect, it } from "vitest";
import { formatPlanDate, formatPlanTime } from "./campaign-format";

describe("plan formatting", () => {
  it("shows dates in American style without shifting the day", () => {
    expect(formatPlanDate("2026-10-26")).toBe("Mon, Oct 26");
    expect(formatPlanDate("2026-12-31")).toBe("Thu, Dec 31");
  });

  it("shows times on a 12-hour clock", () => {
    expect(formatPlanTime("10:00")).toBe("10:00 AM");
    expect(formatPlanTime("12:00")).toBe("12:00 PM");
    expect(formatPlanTime("00:30")).toBe("12:30 AM");
    expect(formatPlanTime("18:00")).toBe("6:00 PM");
  });

  it("leaves unexpected input alone", () => {
    expect(formatPlanDate("nope")).toBe("nope");
    expect(formatPlanTime("later")).toBe("later");
  });
});
