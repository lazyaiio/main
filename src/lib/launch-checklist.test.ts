import { describe, expect, it } from "vitest";
import { LAUNCH_ITEMS, MANUAL_IDS, cleanDone, evaluate, isManualId, summarize, type LaunchFacts } from "./launch-checklist";

const ready: LaunchFacts = {
  environment: "production", appUrlIsHttps: true, deployProblems: 0, deployWarnings: 0, missingMigrations: [],
  contactEmailSet: true, operatorNameSet: true, operatorCountrySet: true, emailSendingReady: true, emailWebhookReady: true,
  paidPlansWithPrice: 2, bkashReady: true, bkashMode: "live", socialMode: "meta", socialReady: true, liveFlagOn: true,
  publishingBlockedByEnv: false, cronSecretSet: true, heartbeatAgeMinutes: 1, publishedBlogPosts: 9, insightsOn: true,
};
const allDone = Object.fromEntries(MANUAL_IDS.map((id) => [id, "2026-11-08T10:00:00.000Z"]));
const state = (facts: LaunchFacts, id: string, done = {}) => evaluate(facts, done).find((i) => i.id === id)?.state;

describe("checklist definition", () => {
  it("has unique ids and every automatic item is handled", () => {
    expect(new Set(LAUNCH_ITEMS.map((i) => i.id)).size).toBe(LAUNCH_ITEMS.length);
    for (const item of evaluate(ready, {})) if (item.kind === "auto") expect(item.detail).not.toBe("Unknown item.");
  });
  it("needs no Bengali anywhere", () => {
    for (const i of LAUNCH_ITEMS) expect(`${i.title}${i.where}`).not.toMatch(/[\u0980-\u09FF]/);
  });
});

describe("evaluate and summarize", () => {
  it("is ready only when every required item is done", () => {
    expect(summarize(evaluate(ready, allDone)).ready).toBe(true);
    expect(summarize(evaluate(ready, {})).ready).toBe(false);
    expect(summarize(evaluate({ ...ready, bkashMode: "sandbox" }, allDone)).ready).toBe(false);
  });
  it("lists what blocks launch and the percent done", () => {
    const s = summarize(evaluate(ready, {}));
    expect(s.blockers.length).toBe(s.required - s.requiredDone);
    expect(s.percent).toBeLessThan(100);
    expect(summarize(evaluate(ready, allDone)).percent).toBe(100);
  });
  it("optional items never block", () => {
    const s = summarize(evaluate({ ...ready, publishedBlogPosts: 0, emailWebhookReady: false }, allDone));
    expect(s.ready).toBe(true);
  });
  it("reads each automatic fact", () => {
    expect(state({ ...ready, environment: "preview" }, "site-production")).toBe("todo");
    expect(state({ ...ready, appUrlIsHttps: false }, "site-production")).toBe("todo");
    expect(state({ ...ready, deployProblems: 2 }, "site-deploy-checks")).toBe("todo");
    expect(state({ ...ready, deployWarnings: 1 }, "site-deploy-checks")).toBe("warn");
    expect(state({ ...ready, missingMigrations: ["0024"] }, "site-migrations")).toBe("todo");
    expect(state({ ...ready, contactEmailSet: false }, "site-legal-details")).toBe("todo");
    expect(state({ ...ready, paidPlansWithPrice: 0 }, "money-plans")).toBe("todo");
    expect(state({ ...ready, bkashReady: false }, "money-bkash")).toBe("todo");
    expect(state({ ...ready, bkashMode: null }, "money-bkash-live")).toBe("todo");
    expect(state({ ...ready, emailSendingReady: false }, "email-sending")).toBe("todo");
    expect(state({ ...ready, socialMode: "mock" }, "pub-facebook")).toBe("todo");
    expect(state({ ...ready, liveFlagOn: false }, "pub-live-flag")).toBe("todo");
    expect(state({ ...ready, publishingBlockedByEnv: true }, "pub-live-flag")).toBe("todo");
  });
  it("treats a silent or missing scheduler as not ready", () => {
    expect(state({ ...ready, heartbeatAgeMinutes: null }, "pub-scheduler")).toBe("todo");
    expect(state({ ...ready, heartbeatAgeMinutes: 11 }, "pub-scheduler")).toBe("todo");
    expect(state({ ...ready, cronSecretSet: false }, "pub-scheduler")).toBe("todo");
    expect(state({ ...ready, heartbeatAgeMinutes: 10 }, "pub-scheduler")).toBe("ok");
  });
});

describe("cleanDone", () => {
  it("keeps only known manual ids with real dates", () => {
    const out = cleanDone({ "legal-lawyer": "2026-11-08T10:00:00Z", "site-production": "2026-11-08T10:00:00Z", "meta-live": "not a date", made_up: "2026-11-08T10:00:00Z" });
    expect(out).toEqual({ "legal-lawyer": "2026-11-08T10:00:00Z" });
    expect(cleanDone(null)).toEqual({});
    expect(isManualId("site-production")).toBe(false);
    expect(isManualId("legal-lawyer")).toBe(true);
  });
});
