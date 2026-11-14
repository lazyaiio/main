import { describe, expect, it } from "vitest";
import { INSIGHTS_SCOPE } from "./insights";
import { META_PERMISSIONS, PERMISSION_ANSWERS, PUBLIC_PAGE_PROBES, REJECTION_RISKS, SCREENCAST_STEPS, judgePage, metaChecks, reviewerInstructions, type MetaFacts } from "./meta-review";
import { META_REQUIRED_SCOPES } from "./social/meta-provider";

const good: MetaFacts = { appIdSet: true, appSecretSet: true, tokenKeySet: true, redirectUriMatches: true, contactEmailSet: true, operatorNameSet: true, operatorCountrySet: true, mock: false, liveFlagOn: true, cronReady: true, isHttps: true, insightsOn: true };
const long = "x".repeat(600);

describe("permissions", () => {
  it("match the scopes the app really requests (three required, read_insights optional)", () => {
    expect([...META_PERMISSIONS].sort()).toEqual([...META_REQUIRED_SCOPES, INSIGHTS_SCOPE].sort());
    for (const p of META_PERMISSIONS) expect(PERMISSION_ANSWERS[p].length).toBeGreaterThan(80);
  });
  it("has a screencast that mentions every permission and is in order", () => {
    const text = SCREENCAST_STEPS.map((s) => s.say).join(" ");
    for (const p of META_PERMISSIONS) expect(text).toContain(p);
    const seconds = SCREENCAST_STEPS.map((s) => Number(s.time.split(":")[0]) * 60 + Number(s.time.split(":")[1]));
    expect([...seconds].sort((a, b) => a - b)).toEqual(seconds);
  });
  it("has instructions with the site address and placeholders for the reviewer login", () => {
    const text = reviewerInstructions("https://example.com");
    expect(text).toContain("https://example.com/auth/login");
    expect(text).toContain("[put the reviewer email here]");
    expect(text).toContain("https://example.com/data-deletion");
  });
  it("lists risks and uses no Bengali", () => {
    expect(REJECTION_RISKS.length).toBeGreaterThan(4);
    expect(JSON.stringify([PERMISSION_ANSWERS, SCREENCAST_STEPS, REJECTION_RISKS])).not.toMatch(/[\u0980-\u09FF]/);
  });
});

describe("judgePage", () => {
  const privacy = PUBLIC_PAGE_PROBES[0]!;
  const contact = PUBLIC_PAGE_PROBES[2]!;
  it("passes a normal page", () => expect(judgePage(privacy, 200, long, "a@b.co").state).toBe("ok"));
  it("cannot fetch -> unknown, not a failure", () => expect(judgePage(privacy, null, "", null).state).toBe("unknown"));
  it("flags a wrong status, an empty page, a missing email and a placeholder", () => {
    expect(judgePage(privacy, 404, "", null).state).toBe("todo");
    expect(judgePage(privacy, 200, "short", null).state).toBe("todo");
    expect(judgePage(contact, 200, long, "support@example.com").state).toBe("todo");
    expect(judgePage(contact, 200, `${long} support@example.com`, "support@example.com").state).toBe("ok");
    expect(judgePage(privacy, 200, `${long} [your business name]`, null).state).toBe("todo");
  });
});

describe("metaChecks", () => {
  it("is all ok when everything is set", () => expect(metaChecks(good).every((c) => c.state === "ok")).toBe(true));
  it("flags each missing piece", () => {
    const bad = (over: Partial<MetaFacts>, id: string) => metaChecks({ ...good, ...over }).find((c) => c.id === id)?.state;
    expect(bad({ isHttps: false }, "https")).toBe("todo");
    expect(bad({ appSecretSet: false }, "app")).toBe("todo");
    expect(bad({ mock: true }, "mock")).toBe("todo");
    expect(bad({ contactEmailSet: false }, "email")).toBe("todo");
    expect(bad({ cronReady: false }, "cron")).toBe("todo");
    expect(bad({ liveFlagOn: false }, "live")).toBe("warn");
    expect(bad({ insightsOn: false }, "insights")).toBe("warn");
  });
});
