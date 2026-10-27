import { describe, expect, it } from "vitest";
import {
  PrepareError,
  backoffSeconds,
  checkCronAuth,
  composePostMessage,
  decideAfterError,
  isAuthorizedCron,
  runDispatch,
  type DispatchDeps,
  type DuePost,
} from "./publish-dispatch";

function social(kind: string, uncertain = false) {
  const error = new Error(kind);
  error.name = "SocialError";
  return Object.assign(error, { kind, details: { uncertain } });
}

describe("backoffSeconds", () => {
  it("grows with each attempt and stops growing at three hours", () => {
    expect([1, 2, 3, 4, 5, 6, 50].map(backoffSeconds)).toEqual([60, 300, 900, 3600, 10800, 10800, 10800]);
    expect(backoffSeconds(0)).toBe(60);
  });
});

describe("decideAfterError", () => {
  it("retries problems that will pass, with a delay", () => {
    expect(decideAfterError(social("rate_limited"), 1)).toEqual({ action: "retry", code: "rate_limited", delaySeconds: 60 });
    expect(decideAfterError(social("temporary"), 3)).toEqual({ action: "retry", code: "temporary", delaySeconds: 900 });
  });

  it("never retries when we cannot tell whether the post was created", () => {
    expect(decideAfterError(social("temporary", true), 1)).toEqual({ action: "uncertain" });
    expect(decideAfterError(social("unknown", true), 1)).toEqual({ action: "uncertain" });
  });

  it("fails permanent problems at once and flags Page problems", () => {
    expect(decideAfterError(social("token_expired"), 1)).toEqual({ action: "fail", code: "token_expired", pageProblem: "token_expired" });
    expect(decideAfterError(social("permission_missing"), 1)).toMatchObject({ action: "fail", pageProblem: "permission_missing" });
    expect(decideAfterError(social("page_access_lost"), 1)).toMatchObject({ action: "fail", pageProblem: "page_access_lost" });
    expect(decideAfterError(social("content_rejected"), 1)).toEqual({ action: "fail", code: "content_rejected" });
    expect(decideAfterError(social("invalid_request"), 1)).toEqual({ action: "fail", code: "invalid_request" });
  });

  it("handles preparation problems and surprises", () => {
    expect(decideAfterError(new PrepareError("not_approved", false), 1)).toEqual({ action: "fail", code: "not_approved" });
    expect(decideAfterError(new PrepareError("image_download", true), 2)).toEqual({ action: "retry", code: "image_download", delaySeconds: 300 });
    expect(decideAfterError(new Error("boom"), 1)).toEqual({ action: "fail", code: "unexpected" });
    expect(decideAfterError("string", 1)).toEqual({ action: "fail", code: "unexpected" });
  });
});

describe("composePostMessage", () => {
  it("adds the call to action and hashtags once", () => {
    expect(composePostMessage({ body: " Fresh bread today. ", cta: "Order now.", hashtags: ["bakery", "#fresh", "local bread"] })).toBe(
      "Fresh bread today.\n\nOrder now.\n\n#bakery #fresh #localbread",
    );
  });

  it("does not repeat a call to action or hashtag that is already in the body", () => {
    expect(composePostMessage({ body: "Order now. Love our #Bakery!", cta: "Order now.", hashtags: ["bakery", "bread"] })).toBe("Order now. Love our #Bakery!\n\n#bread");
  });

  it("works with nothing extra and ignores empty tags", () => {
    expect(composePostMessage({ body: "Hello", cta: null, hashtags: [] })).toBe("Hello");
    expect(composePostMessage({ body: "Hello", cta: "  ", hashtags: ["", "#", " "] })).toBe("Hello");
  });
});

describe("checkCronAuth", () => {
  const secret = "a-long-cron-secret-123456";
  it("says why a request was refused, without revealing the secret", () => {
    expect(checkCronAuth(`Bearer ${secret}`, secret)).toBe("ok");
    expect(checkCronAuth(`Bearer wrong-secret-1234567`, secret)).toBe("invalid");
    expect(checkCronAuth(`Bearer ${secret} `, secret)).toBe("ok"); // stray trailing space from copy and paste
    expect(checkCronAuth(null, secret)).toBe("missing");
    expect(checkCronAuth("Basic abc", secret)).toBe("missing");
    expect(checkCronAuth("Bearer ", secret)).toBe("missing");
    expect(checkCronAuth(`Bearer ${secret}`, null)).toBe("not_configured");
    expect(checkCronAuth(null, null)).toBe("not_configured");
  });
});

describe("isAuthorizedCron", () => {
  const secret = "a-long-cron-secret-123456";
  it("accepts only the exact bearer secret", () => {
    expect(isAuthorizedCron(`Bearer ${secret}`, secret)).toBe(true);
    expect(isAuthorizedCron(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isAuthorizedCron(`Bearer wrong-secret-1234567`, secret)).toBe(false);
    expect(isAuthorizedCron(secret, secret)).toBe(false);
    expect(isAuthorizedCron(null, secret)).toBe(false);
    expect(isAuthorizedCron("", secret)).toBe(false);
  });
  it("fails closed when no secret is configured", () => {
    expect(isAuthorizedCron("Bearer anything", null)).toBe(false);
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
  });
});

function makeDeps(overrides: Partial<DispatchDeps> & { posts?: DuePost[] } = {}) {
  const log = { published: [] as string[], retry: [] as string[], failed: [] as string[], released: [] as string[], pageProblems: [] as string[], publishCalls: 0 };
  let clock = 0;
  const posts = overrides.posts ?? [{ id: "p1", attempt: 1 }, { id: "p2", attempt: 1 }];
  const deps: DispatchDeps = {
    now: () => clock,
    enabled: true,
    claim: async (limit) => posts.splice(0, limit),
    publish: async (post) => {
      log.publishCalls++;
      clock += 3000;
      return `fb_${post.id}`;
    },
    finishPublished: async (post) => {
      log.published.push(post.id);
      return true;
    },
    finishRetry: async (post, code) => void log.retry.push(`${post.id}:${code}`),
    finishFailed: async (post, code) => void log.failed.push(`${post.id}:${code}`),
    release: async (post) => void log.released.push(post.id),
    onPageProblem: async (post, problem) => void log.pageProblems.push(`${post.id}:${problem}`),
    ...overrides,
  };
  return { deps, log };
}

describe("runDispatch", () => {
  it("publishes each claimed post once", async () => {
    const { deps, log } = makeDeps();
    const summary = await runDispatch(deps);
    expect(summary).toMatchObject({ claimed: 2, published: 2, failed: 0, retrying: 0, uncertain: 0, returned: 0, disabled: false });
    expect(log.published).toEqual(["p1", "p2"]);
    expect(log.publishCalls).toBe(2);
  });

  it("does nothing, and claims nothing, while live publishing is switched off", async () => {
    let claimed = false;
    const { deps, log } = makeDeps({ enabled: false, claim: async () => ((claimed = true), []) });
    const summary = await runDispatch(deps);
    expect(summary.disabled).toBe(true);
    expect(claimed).toBe(false);
    expect(log.publishCalls).toBe(0);
  });

  it("running it twice never publishes the same post twice (the claim hands each post out once)", async () => {
    const { deps, log } = makeDeps();
    await runDispatch(deps);
    await runDispatch(deps);
    expect(log.publishCalls).toBe(2);
  });

  it("sends temporary problems to retry and permanent ones to failed, and keeps going", async () => {
    const { deps, log } = makeDeps({
      posts: [{ id: "a", attempt: 1 }, { id: "b", attempt: 1 }, { id: "c", attempt: 1 }],
      publish: async (post) => {
        if (post.id === "a") throw social("rate_limited");
        if (post.id === "b") throw social("token_expired");
        return "fb_c";
      },
    });
    const summary = await runDispatch(deps);
    expect(summary).toMatchObject({ retrying: 1, failed: 1, published: 1 });
    expect(log.retry).toEqual(["a:rate_limited"]);
    expect(log.failed).toEqual(["b:token_expired"]);
    expect(log.pageProblems).toEqual(["b:token_expired"]);
    expect(log.published).toEqual(["c"]);
  });

  it("records an uncertain result as failed and never retries it", async () => {
    const { deps, log } = makeDeps({
      posts: [{ id: "u", attempt: 1 }],
      publish: async () => {
        throw social("temporary", true);
      },
    });
    const summary = await runDispatch(deps);
    expect(summary.uncertain).toBe(1);
    expect(log.failed).toEqual(["u:uncertain_result"]);
    expect(log.retry).toEqual([]);
  });

  it("hands unused posts back when time is nearly up", async () => {
    const { deps, log } = makeDeps({
      posts: [{ id: "a", attempt: 1 }, { id: "b", attempt: 1 }, { id: "c", attempt: 1 }],
    });
    let clock = 0;
    deps.now = () => clock;
    deps.publish = async (post) => {
      clock += 20_000;
      return `fb_${post.id}`;
    };
    const summary = await runDispatch(deps, { maxPosts: 5, budgetMs: 45_000, minPostMs: 15_000 });
    expect(summary.published).toBe(2);
    expect(summary.returned).toBe(1);
    expect(log.released).toEqual(["c"]);
  });

  it("does not publish a second time when recording the success fails", async () => {
    let attempts = 0;
    const { deps, log } = makeDeps({
      posts: [{ id: "x", attempt: 1 }],
      finishPublished: async () => {
        attempts++;
        throw new Error("database down");
      },
    });
    const summary = await runDispatch(deps);
    expect(log.publishCalls).toBe(1);
    expect(attempts).toBe(3);
    expect(summary.published).toBe(1);
  });

  it("survives a failing database call while recording a failure", async () => {
    const { deps } = makeDeps({
      posts: [{ id: "x", attempt: 1 }, { id: "y", attempt: 1 }],
      publish: async (post) => {
        if (post.id === "x") throw social("content_rejected");
        return "fb_y";
      },
      finishFailed: async () => {
        throw new Error("database down");
      },
    });
    const summary = await runDispatch(deps);
    expect(summary.published).toBe(1);
  });

  it("limits how many posts one run claims", async () => {
    let asked = 0;
    const { deps } = makeDeps({ claim: async (limit) => ((asked = limit), []) });
    await runDispatch(deps, { maxPosts: 3, budgetMs: 45_000, minPostMs: 15_000 });
    expect(asked).toBe(3);
  });
});
