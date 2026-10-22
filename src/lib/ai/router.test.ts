import { describe, expect, it } from "vitest";
import { AiError } from "./errors";
import { generateWithFallback, type EnabledProvider } from "./router";
import type { ProviderId, TextGenerationProvider } from "./types";

const request = { system: "s", user: "u", maxTokens: 100, json: true };

function fake(id: ProviderId, behavior: (call: number) => Promise<string>): TextGenerationProvider & { calls: number } {
  const provider = {
    id,
    calls: 0,
    async generate() {
      provider.calls += 1;
      const text = await behavior(provider.calls);
      return { text, inputTokens: 1, outputTokens: 2 };
    },
  };
  return provider;
}

const list = (...ids: ProviderId[]): EnabledProvider[] => ids.map((id, i) => ({ provider: id, model: `${id}-m`, priority: (i + 1) * 10 }));
const noSleep = async () => {};

describe("generateWithFallback", () => {
  it("uses the first provider when it works", async () => {
    const a = fake("anthropic", async () => "ok-a");
    const b = fake("openai", async () => "ok-b");
    const result = await generateWithFallback(request, {
      providers: list("anthropic", "openai"),
      getProvider: (id) => (id === "anthropic" ? a : b),
      sleep: noSleep,
    });
    expect(result.text).toBe("ok-a");
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("anthropic-m");
    expect(b.calls).toBe(0);
  });

  it("orders providers by priority number, not list order", async () => {
    const a = fake("anthropic", async () => "a");
    const b = fake("openai", async () => "b");
    const result = await generateWithFallback(request, {
      providers: [
        { provider: "anthropic", model: "m", priority: 50 },
        { provider: "openai", model: "m", priority: 5 },
      ],
      getProvider: (id) => (id === "anthropic" ? a : b),
      sleep: noSleep,
    });
    expect(result.provider).toBe("openai");
  });

  it("retries a busy provider once, then succeeds", async () => {
    const a = fake("anthropic", async (n) => {
      if (n === 1) throw new AiError("rate_limit", "x");
      return "second-try";
    });
    const result = await generateWithFallback(request, { providers: list("anthropic"), getProvider: () => a, sleep: noSleep });
    expect(result.text).toBe("second-try");
    expect(a.calls).toBe(2);
  });

  it("falls back to the next provider after bounded retries", async () => {
    const a = fake("anthropic", async () => {
      throw new AiError("provider", "x");
    });
    const b = fake("openai", async () => "from-b");
    const result = await generateWithFallback(request, {
      providers: list("anthropic", "openai"),
      getProvider: (id) => (id === "anthropic" ? a : b),
      sleep: noSleep,
    });
    expect(result.provider).toBe("openai");
    expect(a.calls).toBe(2);
    expect(result.attempts.map((x) => x.kind)).toEqual(["provider", "provider", "ok"]);
  });

  it("does not retry an authentication failure but moves on", async () => {
    const a = fake("anthropic", async () => {
      throw new AiError("auth", "x");
    });
    const b = fake("openai", async () => "from-b");
    const result = await generateWithFallback(request, {
      providers: list("anthropic", "openai"),
      getProvider: (id) => (id === "anthropic" ? a : b),
      sleep: noSleep,
    });
    expect(a.calls).toBe(1);
    expect(result.provider).toBe("openai");
  });

  it("skips providers without a key and reports not_configured when none remain", async () => {
    let kind = "";
    try {
      await generateWithFallback(request, { providers: list("anthropic"), getProvider: () => null, sleep: noSleep });
    } catch (error) {
      kind = error instanceof AiError ? error.kind : "other";
    }
    expect(kind).toBe("not_configured");
  });

  it("reports the last failure kind when every provider fails", async () => {
    const a = fake("anthropic", async () => {
      throw new AiError("rate_limit", "x");
    });
    let kind = "";
    try {
      await generateWithFallback(request, { providers: list("anthropic"), getProvider: () => a, sleep: noSleep });
    } catch (error) {
      kind = error instanceof AiError ? error.kind : "other";
    }
    expect(kind).toBe("rate_limit");
  });

  it("stops when the time budget is used up", async () => {
    let clock = 0;
    const a = fake("anthropic", async () => {
      clock += 60_000;
      throw new AiError("timeout", "x");
    });
    let kind = "";
    try {
      await generateWithFallback(request, {
        providers: list("anthropic"),
        getProvider: () => a,
        sleep: noSleep,
        now: () => clock,
        deadlineMs: 50_000,
      });
    } catch (error) {
      kind = error instanceof AiError ? error.kind : "other";
    }
    expect(kind).toBe("timeout");
    expect(a.calls).toBe(1);
  });
});
