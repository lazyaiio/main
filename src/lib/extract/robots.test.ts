import { describe, expect, it } from "vitest";
import { ExtractError } from "./errors";
import { assertRobotsAllow, parseRobots } from "./robots";
import type { Resolver, Transport } from "./safe-fetch";

describe("parseRobots", () => {
  it("allows everything when there are no rules", () => {
    expect(parseRobots("", "lazyaibot").allows("/anything")).toBe(true);
  });

  it("applies the * group and longest-match precedence", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /private\nAllow: /private/public\n", "lazyaibot");
    expect(rules.allows("/private/secret")).toBe(false);
    expect(rules.allows("/private/public/page")).toBe(true);
    expect(rules.allows("/blog")).toBe(true);
  });

  it("prefers a group that names our crawler", () => {
    const text = "User-agent: *\nAllow: /\n\nUser-agent: LazyAIBot\nDisallow: /\n";
    expect(parseRobots(text, "lazyaibot").allows("/post")).toBe(false);
    expect(parseRobots(text, "otherbot").allows("/post")).toBe(true);
  });

  it("supports wildcards, end anchors, comments, and empty Disallow", () => {
    const rules = parseRobots("User-agent: *\n# comment\nDisallow: /*.pdf$\nDisallow: /tmp/*/cache # trailing\nDisallow:\n", "lazyaibot");
    expect(rules.allows("/files/a.pdf")).toBe(false);
    expect(rules.allows("/files/a.pdf?x=1")).toBe(true);
    expect(rules.allows("/tmp/x/cache")).toBe(false);
    expect(rules.allows("/open")).toBe(true);
  });

  it("ignores absurd patterns instead of hanging", () => {
    const evil = `User-agent: *\nDisallow: ${"*a".repeat(50)}b\n`;
    expect(parseRobots(evil, "lazyaibot").allows("/aaaaaaaaaaaaaaaaaaaaaaaa")).toBe(true);
  });

  it("handles several user-agent lines sharing one group", () => {
    const rules = parseRobots("User-agent: a\nUser-agent: lazyaibot\nDisallow: /x\n", "lazyaibot");
    expect(rules.allows("/x/1")).toBe(false);
  });
});

const PUBLIC: Resolver = async () => [{ address: "93.184.216.34", family: 4 }];
function robotsTransport(reply: { status?: number; body?: string; fail?: boolean }): Transport {
  return async () => {
    if (reply.fail) throw new Error("ECONNRESET");
    return {
      status: reply.status ?? 200,
      headers: { "content-type": "text/plain" },
      body: (async function* () {
        yield Buffer.from(reply.body ?? "");
      })(),
    };
  };
}
async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "none";
  } catch (error) {
    return error instanceof ExtractError ? error.kind : "other";
  }
}
const run = (reply: Parameters<typeof robotsTransport>[0], path = "https://example.com/blog/post") =>
  assertRobotsAllow(new URL(path), "lazyaibot", { resolve: PUBLIC, userAgent: "x", transport: robotsTransport(reply) });

describe("assertRobotsAllow", () => {
  it("allows when robots.txt is missing or forbidden (4xx)", async () => {
    expect(await kindOf(run({ status: 404 }))).toBe("none");
    expect(await kindOf(run({ status: 403 }))).toBe("none");
  });

  it("blocks pages the site disallows", async () => {
    expect(await kindOf(run({ body: "User-agent: *\nDisallow: /blog\n" }))).toBe("robots_disallowed");
    expect(await kindOf(run({ body: "User-agent: *\nDisallow: /admin\n" }))).toBe("none");
  });

  it("does not read the page when robots.txt cannot be checked", async () => {
    expect(await kindOf(run({ status: 500 }))).toBe("robots_unavailable");
    expect(await kindOf(run({ fail: true }))).toBe("robots_unavailable");
  });
});
