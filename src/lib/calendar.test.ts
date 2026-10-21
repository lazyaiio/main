import { describe, expect, it } from "vitest";
import { buildMonthGrid, localDateKey, monthLabel, monthQueryRange, parseMonthParam, shiftMonth } from "./calendar";

describe("calendar", () => {
  it("builds a Sunday-first grid for October 2026", () => {
    const weeks = buildMonthGrid("2026-10");
    const flat = weeks.flat();
    expect(weeks).toHaveLength(5);
    expect(flat[0]).toEqual({ iso: "2026-09-27", day: 27, inMonth: false });
    expect(flat.at(-1)).toEqual({ iso: "2026-10-31", day: 31, inMonth: true });
    expect(flat.filter((d) => d.inMonth)).toHaveLength(31);
  });

  it("uses six rows when a month needs them", () => {
    expect(buildMonthGrid("2026-08")).toHaveLength(6);
  });

  it("validates and shifts month parameters", () => {
    expect(parseMonthParam("2026-10", "2026-01")).toBe("2026-10");
    expect(parseMonthParam("2026-13", "2026-01")).toBe("2026-01");
    expect(parseMonthParam(undefined, "2026-01")).toBe("2026-01");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthLabel("2026-10")).toBe("October 2026");
  });

  it("assigns instants to the local calendar day", () => {
    expect(localDateKey("2026-10-20T19:30:00Z", "Asia/Dhaka")).toBe("2026-10-21");
    expect(localDateKey("2026-10-20T19:30:00Z", "UTC")).toBe("2026-10-20");
  });

  it("pads the query range around the month", () => {
    const r = monthQueryRange("2026-10");
    expect(r.fromIso < "2026-10-01T00:00:00.000Z").toBe(true);
    expect(r.toIso > "2026-11-01T00:00:00.000Z").toBe(true);
  });
});
