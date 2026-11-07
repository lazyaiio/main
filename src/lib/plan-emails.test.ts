import { describe, expect, it } from "vitest";
import { renderEmail } from "./email/templates";
import { daysUntil, endedKey, endingSoonKey, formatEndDate, receiptKey } from "./plan-emails";

const APP = "https://lazyai.example";

describe("plan email helpers", () => {
  it("formats the end date in UTC", () => {
    expect(formatEndDate("2027-05-03T23:59:59Z")).toBe("May 3, 2027");
    expect(formatEndDate("nonsense")).toBe("");
  });
  it("counts days up and never goes below zero", () => {
    const now = new Date("2026-11-08T10:00:00Z");
    expect(daysUntil("2026-11-15T10:00:00Z", now)).toBe(7);
    expect(daysUntil("2026-11-08T12:00:00Z", now)).toBe(1);
    expect(daysUntil("2026-11-01T10:00:00Z", now)).toBe(0);
  });
  it("makes one dedupe key per workspace and end date, and a new one after a renewal", () => {
    expect(endingSoonKey("w1", "2026-11-15T23:59:59Z")).toBe("plan_ending:w1:2026-11-15");
    expect(endingSoonKey("w1", "2026-12-15T23:59:59Z")).not.toBe(endingSoonKey("w1", "2026-11-15T23:59:59Z"));
    expect(endedKey("w1", "2026-11-15T23:59:59Z")).toBe("plan_ended:w1:2026-11-15");
    expect(receiptKey("p1")).toBe("receipt:p1");
  });
});

describe("payment and plan emails", () => {
  it("receipt shows the invoice, plan, amount and end date, and links to billing", () => {
    const mail = renderEmail({ template: "payment_receipt", name: "Jane", invoice: "LZ261108ABCD1234", planName: "Pro", periodLabel: "Monthly", amountText: "BDT 990", endsOn: "December 8, 2026" }, APP);
    expect(mail.subject).toBe("Your LazyAI receipt (LZ261108ABCD1234)");
    for (const part of ["LZ261108ABCD1234", "Pro", "BDT 990", "December 8, 2026", `${APP}/app/billing`]) {
      expect(mail.html).toContain(part);
      expect(mail.text).toContain(part);
    }
  });
  it("receipt for a lifetime plan says it does not expire", () => {
    const mail = renderEmail({ template: "payment_receipt", name: null, invoice: "LZ1", planName: "Pro", periodLabel: "Lifetime", amountText: "BDT 9,900", endsOn: null }, APP);
    expect(mail.text).toContain("This plan does not expire.");
    expect(mail.text.startsWith("Hi,")).toBe(true);
  });
  it("ending soon names the plan, the date and how long is left", () => {
    const mail = renderEmail({ template: "plan_ending_soon", name: "Jane", planName: "Pro", endsOn: "November 15, 2026", days: 7 }, APP);
    expect(mail.subject).toBe("Your LazyAI Pro plan ends in 7 days");
    expect(mail.text).toContain("November 15, 2026");
    expect(mail.text).toContain("Nothing is charged automatically");
    expect(renderEmail({ template: "plan_ending_soon", name: null, planName: "Pro", endsOn: "x", days: 1 }, APP).subject).toBe("Your LazyAI Pro plan ends in less than a day");
  });
  it("plan ended says the content is kept and the workspace is on Free", () => {
    const mail = renderEmail({ template: "plan_ended", name: "Jane", planName: "Pro" }, APP);
    expect(mail.subject).toBe("Your LazyAI Pro plan has ended");
    expect(mail.text).toContain("Free plan");
    expect(mail.text).toContain("not deleted");
  });
  it("escapes everything that comes from data", () => {
    const evil = '<script>alert("x")</script>';
    for (const data of [
      { template: "payment_receipt", name: evil, invoice: evil, planName: evil, periodLabel: evil, amountText: evil, endsOn: evil },
      { template: "plan_ending_soon", name: evil, planName: evil, endsOn: evil, days: 3 },
      { template: "plan_ended", name: evil, planName: evil },
    ] as const) {
      expect(renderEmail(data, APP).html).not.toContain("<script>");
    }
  });
  it("keeps line breaks out of subject lines", () => {
    const mail = renderEmail({ template: "plan_ended", name: null, planName: "Pro\nBcc: x@example.com" }, APP);
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });
});
