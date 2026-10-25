import { describe, expect, it } from "vitest";
import { META_REQUIRED_SCOPES, appSecretProof, classifyGraphError, createMetaProvider } from "./meta-provider";
import { createMockProvider, MOCK_CODE } from "./mock-provider";
import { SocialError, describeSocialError } from "./provider";

const CONFIG = { appId: "1234567890", appSecret: "app-secret-value", apiVersion: "v25.0", loginConfigId: null };

type Call = { url: string; init?: RequestInit };

function fakeFetch(handler: (call: Call) => Response | Promise<Response>, calls: Call[] = []): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    return Promise.resolve(handler(call));
  }) as typeof fetch;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("appSecretProof", () => {
  it("is the documented HMAC-SHA256 hex of the token", () => {
    // Known value, computed independently with openssl and Python.
    expect(appSecretProof("token", "secret")).toBe("e941110e3d2bfe82621f0e3e1434730d7305d106c5f68c87165d0b27a4611a4a");
    expect(appSecretProof("token", "secret")).not.toBe(appSecretProof("token2", "secret"));
  });
});

describe("authorization URL", () => {
  it("uses permissions (scope) for a classic login", () => {
    const url = new URL(createMetaProvider(CONFIG).buildAuthorizationUrl({ state: "STATE", redirectUri: "https://app.example/api/meta/callback" }));
    expect(url.origin + url.pathname).toBe("https://www.facebook.com/v25.0/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("1234567890");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example/api/meta/callback");
    expect(url.searchParams.get("state")).toBe("STATE");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(META_REQUIRED_SCOPES.join(","));
    expect(url.searchParams.get("config_id")).toBeNull();
    expect(url.searchParams.get("client_secret")).toBeNull();
  });

  it("uses the Facebook Login for Business configuration when one is set", () => {
    const url = new URL(createMetaProvider({ ...CONFIG, loginConfigId: "999" }).buildAuthorizationUrl({ state: "S", redirectUri: "https://app.example/cb" }));
    expect(url.searchParams.get("config_id")).toBe("999");
    expect(url.searchParams.get("override_default_response_type")).toBe("true");
    expect(url.searchParams.get("scope")).toBeNull();
  });
});

describe("token calls", () => {
  it("exchanges a code and then a long-lived token", async () => {
    const calls: Call[] = [];
    const provider = createMetaProvider(CONFIG, fakeFetch(() => json({ access_token: "SHORT-TOKEN-123456" }), calls));
    expect(await provider.exchangeCode({ code: "CODE", redirectUri: "https://app.example/cb" })).toEqual({ accessToken: "SHORT-TOKEN-123456" });
    await provider.extendUserToken("SHORT-TOKEN-123456");
    const first = new URL(calls[0]!.url);
    expect(first.pathname).toBe("/v25.0/oauth/access_token");
    expect(first.searchParams.get("code")).toBe("CODE");
    expect(first.searchParams.get("client_secret")).toBe("app-secret-value");
    const second = new URL(calls[1]!.url);
    expect(second.searchParams.get("grant_type")).toBe("fb_exchange_token");
    expect(second.searchParams.get("fb_exchange_token")).toBe("SHORT-TOKEN-123456");
  });

  it("reads token details and treats expires_at 0 as never", async () => {
    const provider = createMetaProvider(
      CONFIG,
      fakeFetch(() => json({ data: { is_valid: true, user_id: 42, scopes: ["pages_show_list", "pages_manage_posts"], expires_at: 0, data_access_expires_at: 1900000000 } })),
    );
    const info = await provider.inspectToken("TOKEN-1234567890");
    expect(info).toMatchObject({ valid: true, userId: "42", expiresAt: null });
    expect(info.scopes).toEqual(["pages_show_list", "pages_manage_posts"]);
    expect(info.dataAccessExpiresAt?.getTime()).toBe(1900000000 * 1000);
  });

  it("maps a bad answer to a safe error", async () => {
    const provider = createMetaProvider(CONFIG, fakeFetch(() => json({ nope: 1 })));
    await expect(provider.exchangeCode({ code: "x", redirectUri: "https://a/b" })).rejects.toBeInstanceOf(SocialError);
  });
});

describe("listPages", () => {
  const accounts = (data: unknown[], next?: string) => ({ data, paging: next ? { next } : undefined });

  it("lists Pages with tasks, signs calls, and marks who can post", async () => {
    const calls: Call[] = [];
    const provider = createMetaProvider(
      CONFIG,
      fakeFetch(({ url }) => {
        if (url.includes("/me/accounts")) {
          return json(
            accounts([
              { id: "111", name: "Bakery", category: "Bakery", tasks: ["CREATE_CONTENT", "MANAGE"], access_token: "PAGE-TOKEN-AAAAAAAA" },
              { id: "222", name: "Analyst Only", tasks: ["ANALYZE"], access_token: "PAGE-TOKEN-BBBBBBBB" },
              { id: "333", name: "No token", tasks: ["MANAGE"] },
            ]),
          );
        }
        return json({ id: "me-1", name: "Jane" });
      }, calls),
    );
    const result = await provider.listPages("USER-TOKEN-0123456789");
    expect(result.user).toEqual({ id: "me-1", name: "Jane" });
    expect(result.pages.map((p) => [p.id, p.canPublish])).toEqual([["111", true], ["222", false]]);
    for (const call of calls) {
      const q = new URL(call.url).searchParams;
      expect(q.get("appsecret_proof")).toBe(appSecretProof("USER-TOKEN-0123456789", "app-secret-value"));
    }
  });

  it("follows paging only on Meta's own host", async () => {
    let requests = 0;
    const provider = createMetaProvider(
      CONFIG,
      fakeFetch(({ url }) => {
        requests++;
        if (url.includes("/v25.0/me?")) return json({ id: "me-1" });
        if (url.includes("page=2")) return json(accounts([{ id: "2", name: "Second", tasks: ["MANAGE"], access_token: "PAGE-TOKEN-22222222" }]));
        return json(accounts([{ id: "1", name: "First", tasks: ["MANAGE"], access_token: "PAGE-TOKEN-11111111" }], "https://graph.facebook.com/v25.0/me/accounts?page=2&access_token=x"));
      }),
    );
    expect((await provider.listPages("USER-TOKEN-0123456789")).pages.map((p) => p.id)).toEqual(["1", "2"]);
    expect(requests).toBe(3);

    let evilCalls = 0;
    const evil = createMetaProvider(
      CONFIG,
      fakeFetch(({ url }) => {
        evilCalls++;
        if (url.includes("/v25.0/me?")) return json({ id: "me-1" });
        return json(accounts([{ id: "1", name: "First", tasks: ["MANAGE"], access_token: "PAGE-TOKEN-11111111" }], "https://evil.example.com/steal?token=1"));
      }),
    );
    expect((await evil.listPages("USER-TOKEN-0123456789")).pages).toHaveLength(1);
    expect(evilCalls).toBe(2);
  });
});

describe("checkPage and publish", () => {
  it("checks a Page by numeric id only", async () => {
    const provider = createMetaProvider(CONFIG, fakeFetch(() => json({ id: "111", name: "Bakery" })));
    expect(await provider.checkPage({ id: "111", accessToken: "PAGE-TOKEN-AAAAAAAA" })).toEqual({ name: "Bakery" });
    await expect(provider.checkPage({ id: "111/../x", accessToken: "t" })).rejects.toMatchObject({ kind: "invalid_request" });
  });

  it("publishes a text post with a link", async () => {
    const calls: Call[] = [];
    const provider = createMetaProvider(CONFIG, fakeFetch(() => json({ id: "111_999" }), calls));
    const result = await provider.publish({ id: "111", accessToken: "PAGE-TOKEN-AAAAAAAA" }, { message: "Hello", link: "https://example.com/a" });
    expect(result).toEqual({ providerPostId: "111_999" });
    expect(calls[0]!.url).toBe("https://graph.facebook.com/v25.0/111/feed");
    const body = calls[0]!.init!.body as URLSearchParams;
    expect(body.get("message")).toBe("Hello");
    expect(body.get("link")).toBe("https://example.com/a");
    expect(body.get("appsecret_proof")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("publishes a photo post with the file and caption", async () => {
    const calls: Call[] = [];
    const provider = createMetaProvider(CONFIG, fakeFetch(() => json({ id: "photo-1", post_id: "111_555" }), calls));
    const result = await provider.publish({ id: "111", accessToken: "PAGE-TOKEN-AAAAAAAA" }, { message: "Caption", image: { bytes: new Uint8Array([1, 2, 3]), mime: "image/png" } });
    expect(result).toEqual({ providerPostId: "111_555" });
    expect(calls[0]!.url).toBe("https://graph.facebook.com/v25.0/111/photos");
    const form = calls[0]!.init!.body as FormData;
    expect(form.get("caption")).toBe("Caption");
    expect(form.get("published")).toBe("true");
    expect(form.get("source")).toBeTruthy();
  });

  it("raises a clear error instead of returning a fake id", async () => {
    const provider = createMetaProvider(CONFIG, fakeFetch(() => json({})));
    await expect(provider.publish({ id: "111", accessToken: "t" }, { message: "Hi" })).rejects.toBeInstanceOf(SocialError);
  });
});

describe("error handling", () => {
  const err = (status: number, code: number, subcode?: number) => classifyGraphError(status, { error: { message: "secret detail EAAB123token", type: "OAuthException", code, error_subcode: subcode, fbtrace_id: "TRACE" } });

  it("classifies the common Graph API problems", () => {
    expect(err(400, 190, 463).kind).toBe("token_expired");
    expect(err(400, 190, 458).kind).toBe("token_expired");
    expect(err(403, 200).kind).toBe("permission_missing");
    expect(err(403, 10).kind).toBe("permission_missing");
    expect(err(400, 299).kind).toBe("permission_missing");
    expect(err(400, 4).kind).toBe("rate_limited");
    expect(err(400, 32).kind).toBe("rate_limited");
    expect(err(400, 80001).kind).toBe("rate_limited");
    expect(err(500, 2).kind).toBe("temporary");
    expect(err(400, 100, 33).kind).toBe("page_access_lost");
    expect(err(400, 100).kind).toBe("invalid_request");
    expect(err(400, 368).kind).toBe("content_rejected");
    expect(classifyGraphError(503, null).kind).toBe("temporary");
    expect(classifyGraphError(429, null).kind).toBe("rate_limited");
    expect(classifyGraphError(401, {}).kind).toBe("token_expired");
    expect(classifyGraphError(400, "garbage").kind).toBe("unknown");
  });

  it("never copies Facebook's raw message into ours, but keeps numeric codes for support", () => {
    const error = err(400, 190, 463);
    expect(error.message).not.toContain("EAAB123token");
    expect(error.message).not.toContain("secret detail");
    expect(error.details).toEqual({ status: 400, code: 190, subcode: 463, trace: "TRACE", uncertain: false });
  });

  it("marks results as uncertain when we cannot tell whether a post was created", async () => {
    expect(err(500, 2).details.uncertain).toBe(true);
    expect(err(400, 1).details.uncertain).toBe(true);
    expect(classifyGraphError(503, null).details.uncertain).toBe(true);
    expect(err(400, 4).details.uncertain).toBe(false); // rate limit: Facebook refused the request
    expect(err(403, 200).details.uncertain).toBe(false);
    const timedOut = createMetaProvider(CONFIG, (() => Promise.reject(new Error("timeout"))) as typeof fetch);
    await expect(timedOut.publish({ id: "111", accessToken: "t" }, { message: "Hi" })).rejects.toMatchObject({ details: { uncertain: true } });
    const noId = createMetaProvider(CONFIG, fakeFetch(() => json({})));
    await expect(noId.publish({ id: "111", accessToken: "t" }, { message: "Hi" })).rejects.toMatchObject({ details: { uncertain: true } });
  });

  it("turns network failures into a temporary error", async () => {
    const provider = createMetaProvider(CONFIG, (() => Promise.reject(new Error("socket hang up EAAB-token"))) as typeof fetch);
    await expect(provider.checkPage({ id: "111", accessToken: "t" })).rejects.toMatchObject({ kind: "temporary" });
  });

  it("every error kind has actionable English text", () => {
    for (const kind of ["denied", "token_expired", "permission_missing", "page_access_lost", "rate_limited", "temporary", "content_rejected", "invalid_request", "not_configured", "unknown"] as const) {
      expect(describeSocialError(kind).length).toBeGreaterThan(20);
    }
  });
});

describe("mock provider", () => {
  it("walks the same steps as the real one with no network", async () => {
    const mock = createMockProvider();
    const url = new URL(mock.buildAuthorizationUrl({ state: "ST", redirectUri: "https://app.example/api/meta/callback" }));
    expect(url.searchParams.get("code")).toBe(MOCK_CODE);
    expect(url.searchParams.get("state")).toBe("ST");
    const { accessToken } = await mock.exchangeCode({ code: MOCK_CODE, redirectUri: "x" });
    const { pages } = await mock.listPages(accessToken);
    expect(pages.map((p) => p.canPublish)).toEqual([true, true, false]);
    await expect(mock.exchangeCode({ code: "bad", redirectUri: "x" })).rejects.toMatchObject({ kind: "denied" });
    expect(await mock.checkPage({ id: pages[0]!.id, accessToken: pages[0]!.accessToken })).toEqual({ name: "Mock Bakery" });
    await expect(mock.checkPage({ id: pages[0]!.id, accessToken: "mock-expired" })).rejects.toMatchObject({ kind: "token_expired" });
    await expect(mock.publish({ id: pages[2]!.id, accessToken: pages[2]!.accessToken }, { message: "x" })).rejects.toMatchObject({ kind: "permission_missing" });
    expect((await mock.publish({ id: pages[0]!.id, accessToken: pages[0]!.accessToken }, { message: "x" })).providerPostId).toContain(pages[0]!.id);
  });
});
