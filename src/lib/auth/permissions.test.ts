import { describe, expect, it } from "vitest";
import { canAdmin, canWrite } from "./permissions";

describe("permissions", () => {
  it("lets owners, admins and editors write; viewers cannot", () => {
    expect(canWrite("owner")).toBe(true);
    expect(canWrite("admin")).toBe(true);
    expect(canWrite("editor")).toBe(true);
    expect(canWrite("viewer")).toBe(false);
  });

  it("limits admin actions to owners and admins", () => {
    expect(canAdmin("owner")).toBe(true);
    expect(canAdmin("admin")).toBe(true);
    expect(canAdmin("editor")).toBe(false);
    expect(canAdmin("viewer")).toBe(false);
  });
});
