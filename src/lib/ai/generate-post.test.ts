import { describe, expect, it } from "vitest";
import { AiError } from "./errors";
import { generatePostContent } from "./generate-post";
import type { PostRequest } from "./post-schema";
import type { RouterRequest, RouterResult } from "./router";

const input: PostRequest = {
  projectId: "11111111-1111-4111-8111-111111111111",
  language: "en",
  format: "tip",
  topic: "replying to comments",
  length: "medium",
};

const good = JSON.stringify({ hook: "Hi", body: "Reply within a day.", cta: "Tell us.", hashtags: ["tips"], image_brief: "A phone.", fact_check_flags: ["Within a day"] });

function runner(answers: string[]) {
  const calls: RouterRequest[] = [];
  const run = async (req: RouterRequest): Promise<RouterResult> => {
    calls.push(req);
    const text = answers[Math.min(calls.length - 1, answers.length - 1)] ?? "";
    return { text, inputTokens: 100, outputTokens: 50, provider: "anthropic", model: "m", attempts: [{ provider: "anthropic", kind: "ok" }] };
  };
  return { run, calls };
}

describe("generatePostContent", () => {
  it("returns validated output from a single call", async () => {
    const { run, calls } = runner([good]);
    const result = await generatePostContent(input, run);
    expect(calls).toHaveLength(1);
    expect(result.output.body).toBe("Reply within a day.");
    expect(result.output.fact_check_flags).toEqual(["Within a day"]);
    expect(result.repaired).toBe(false);
    expect(result.inputTokens).toBe(100);
    expect(result.promptVersion).toBe("post-v1");
  });

  it("makes exactly one repair attempt and adds up token usage", async () => {
    const { run, calls } = runner(["not json at all", good]);
    const result = await generatePostContent(input, run);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.user).toContain("could not be used");
    expect(result.repaired).toBe(true);
    expect(result.inputTokens).toBe(200);
    expect(result.outputTokens).toBe(100);
  });

  it("gives up with invalid_output after a failed repair", async () => {
    const { run, calls } = runner(["nope", "still nope"]);
    let kind = "";
    try {
      await generatePostContent(input, run);
    } catch (error) {
      kind = error instanceof AiError ? error.kind : "other";
    }
    expect(kind).toBe("invalid_output");
    expect(calls).toHaveLength(2);
  });

  it("treats wrong-language output as invalid", async () => {
    const bengaliBody = JSON.stringify({ body: "\u099b\u09cb\u099f \u09ac\u09cd\u09af\u09ac\u09b8\u09be" });
    const { run, calls } = runner([bengaliBody, good]);
    const result = await generatePostContent(input, run);
    expect(calls).toHaveLength(2);
    expect(result.output.body).toBe("Reply within a day.");
  });
});
