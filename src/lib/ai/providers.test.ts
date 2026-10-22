import { describe, expect, it } from "vitest";
import { AiError } from "./errors";
import { createMockProvider } from "./mock";
import { createAnthropicProvider } from "./providers/anthropic";
import { createGeminiProvider } from "./providers/gemini";
import { createOpenAiProvider } from "./providers/openai";
import { createOpenRouterProvider } from "./providers/openrouter";
import type { FetchLike, GenerateRequest } from "./types";

const req: GenerateRequest = { system: "SYS", user: "USER", model: "m1", maxTokens: 50, json: true, timeoutMs: 1000 };

type Captured = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

function fakeFetch(payload: unknown, status = 200): { fetchImpl: FetchLike; captured: Captured } {
  const captured: Captured = { url: "", headers: {}, body: {} };
  const fetchImpl: FetchLike = async (url, init) => {
    captured.url = url;
    captured.headers = (init?.headers ?? {}) as Record<string, string>;
    captured.body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(payload), { status });
  };
  return { fetchImpl, captured };
}

async function failureKind(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "none";
  } catch (error) {
    return error instanceof AiError ? error.kind : "other";
  }
}

describe("anthropic provider", () => {
  it("sends the right request and parses text and usage", async () => {
    const { fetchImpl, captured } = fakeFetch({ content: [{ type: "text", text: "hello" }], usage: { input_tokens: 11, output_tokens: 7 } });
    const result = await createAnthropicProvider("KEY", fetchImpl).generate(req);
    expect(result).toEqual({ text: "hello", inputTokens: 11, outputTokens: 7 });
    expect(captured.url).toBe("https://api.anthropic.com/v1/messages");
    expect(captured.headers["x-api-key"]).toBe("KEY");
    expect(captured.body.model).toBe("m1");
    expect(captured.body.system).toBe("SYS");
  });
});

describe("openai provider", () => {
  it("uses chat completions with JSON mode and parses the reply", async () => {
    const { fetchImpl, captured } = fakeFetch({ choices: [{ message: { content: "hi" } }], usage: { prompt_tokens: 3, completion_tokens: 4 } });
    const result = await createOpenAiProvider("KEY", fetchImpl).generate(req);
    expect(result).toEqual({ text: "hi", inputTokens: 3, outputTokens: 4 });
    expect(captured.headers.authorization).toBe("Bearer KEY");
    expect(captured.body.response_format).toEqual({ type: "json_object" });
    expect(captured.body.max_completion_tokens).toBe(50);
  });
});

describe("openrouter provider", () => {
  it("uses max_tokens, skips JSON mode, and identifies the app", async () => {
    const { fetchImpl, captured } = fakeFetch({ choices: [{ message: { content: "yo" } }] });
    const result = await createOpenRouterProvider("KEY", "https://lazyai.example", fetchImpl).generate(req);
    expect(result.text).toBe("yo");
    expect(captured.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(captured.body.max_tokens).toBe(50);
    expect(captured.body.response_format).toBeUndefined();
    expect(captured.headers["HTTP-Referer"]).toBe("https://lazyai.example");
  });
});

describe("gemini provider", () => {
  it("passes the key as a header (not in the URL) and parses candidates", async () => {
    const { fetchImpl, captured } = fakeFetch({
      candidates: [{ content: { parts: [{ text: "a" }, { text: "b" }] } }],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 6 },
    });
    const result = await createGeminiProvider("KEY", fetchImpl).generate(req);
    expect(result).toEqual({ text: "ab", inputTokens: 5, outputTokens: 6 });
    expect(captured.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/m1:generateContent");
    expect(captured.url).not.toContain("KEY");
    expect(captured.headers["x-goog-api-key"]).toBe("KEY");
  });
});

describe("error mapping", () => {
  it("maps HTTP statuses to safe error kinds", async () => {
    for (const [status, kind] of [[401, "auth"], [403, "auth"], [429, "rate_limit"], [503, "provider"], [400, "bad_response"]] as const) {
      const { fetchImpl } = fakeFetch({ error: { message: "secret detail" } }, status);
      expect(await failureKind(createOpenAiProvider("KEY", fetchImpl).generate(req))).toBe(kind);
    }
  });

  it("never leaks the key or provider message in the error", async () => {
    const { fetchImpl } = fakeFetch({ error: { message: "bad key SECRETKEY123" } }, 401);
    try {
      await createOpenAiProvider("SECRETKEY123", fetchImpl).generate(req);
    } catch (error) {
      expect(String((error as Error).message)).not.toContain("SECRETKEY123");
    }
  });

  it("maps network failures and empty replies", async () => {
    const broken: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await failureKind(createOpenAiProvider("KEY", broken).generate(req))).toBe("network");
    const { fetchImpl } = fakeFetch({ choices: [] });
    expect(await failureKind(createOpenAiProvider("KEY", fetchImpl).generate(req))).toBe("bad_response");
  });
});

describe("mock provider", () => {
  it("returns English JSON by default and Bengali JSON on request, without needing a network", async () => {
    const mock = createMockProvider();
    const en = JSON.parse((await mock.generate({ ...req, user: "Language: English (en)" })).text);
    const bn = JSON.parse((await mock.generate({ ...req, user: "Language: Bengali (bn)" })).text);
    expect(en.body.length).toBeGreaterThan(10);
    expect(/[\u0980-\u09FF]/.test(bn.body)).toBe(true);
    expect(/[\u0980-\u09FF]/.test(en.body)).toBe(false);
  });
});
