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
    expect(result.promptVersion).toBe("post-v2");
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

  it("rejects a post that copies the source, then accepts a rewrite", async () => {
    const sourceText =
      "Small businesses that reply to customer comments within a day build trust faster and see more repeat visits, according to the owner of a local bakery who tracked her results for a year.";
    const copied = JSON.stringify({ body: sourceText });
    const rewritten = JSON.stringify({ body: "Answering your customers quickly shows you care, and one bakery owner saw people return more often after she started." });
    const { run, calls } = runner([copied, rewritten]);
    const result = await generatePostContent(input, run, { title: "T", url: "https://example.com/a", siteName: null, text: sourceText });
    expect(calls).toHaveLength(2);
    expect(calls[1]?.user).toContain("copies too much wording");
    expect(result.repaired).toBe(true);
  });

  it("includes the source in the first prompt", async () => {
    const { run, calls } = runner([good]);
    await generatePostContent(input, run, { title: "My article", url: "https://example.com/a", siteName: null, text: "Some article text here." });
    expect(calls[0]?.user).toContain("<source_material>");
    expect(calls[0]?.user).toContain("My article");
  });

  it("treats wrong-language output as invalid", async () => {
    const bengaliBody = JSON.stringify({ body: "\u099b\u09cb\u099f \u09ac\u09cd\u09af\u09ac\u09b8\u09be" });
    const { run, calls } = runner([bengaliBody, good]);
    const result = await generatePostContent(input, run);
    expect(calls).toHaveLength(2);
    expect(result.output.body).toBe("Reply within a day.");
  });
});
