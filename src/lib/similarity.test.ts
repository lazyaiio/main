import { describe, expect, it } from "vitest";
import { findNearDuplicate, recentHooks, similarity } from "./similarity";

const A = "Reply to every customer comment within one day. It shows people you are listening and keeps the conversation going.";
const B = "Reply to every customer comment within one day! It shows people you are listening, and keeps the conversation going.";
const C = "Plan your posting week on Sunday evening so Monday morning feels calm and your schedule stays full without stress.";

describe("similarity", () => {
  it("is 1 for the same words and ignores case and punctuation", () => {
    expect(similarity(A, A)).toBe(1);
    expect(similarity(A, B)).toBeGreaterThan(0.7);
  });

  it("is low for different posts", () => {
    expect(similarity(A, C)).toBeLessThan(0.1);
  });

  it("handles empty and very short text", () => {
    expect(similarity("", A)).toBe(0);
    expect(similarity("Hi there", "Hi there")).toBe(1);
  });

  it("compares Bengali text word by word (escape sequences keep the source file English-only)", () => {
    const one = "\u0986\u099c\u0995\u09c7\u09b0 \u099f\u09bf\u09aa \u099b\u09cb\u099f \u09ac\u09cd\u09af\u09ac\u09b8\u09be\u09b0 \u099c\u09a8\u09cd\u09af \u098f\u0995\u099f\u09bf \u09b8\u09b9\u099c \u09aa\u09b0\u09be\u09ae\u09b0\u09cd\u09b6";
    const two = "\u09b8\u09aa\u09cd\u09a4\u09be\u09b9\u09c7\u09b0 \u09aa\u09cd\u09b2\u09cd\u09af\u09be\u09a8 \u09b0\u09be\u0996\u09c1\u09a8 \u09b6\u09c1\u09b0\u09c1\u09a4\u09c7\u0987 \u098f\u0995\u099f\u09bf \u09a6\u09bf\u09a8 \u09b8\u09ae\u09df \u09a8\u09bf\u09a8";
    expect(similarity(one, one)).toBe(1);
    expect(similarity(one, two)).toBeLessThan(0.2);
  });
});

describe("findNearDuplicate", () => {
  it("flags reworded copies and returns which post it repeats", () => {
    const found = findNearDuplicate({ hook: "New", body: B }, [{ id: "c", hook: "Other", body: C }, { id: "a", hook: "Tip", body: A }]);
    expect(found?.id).toBe("a");
    expect(found?.reason).toBe("similar_text");
  });

  it("flags the same opening line even when the body differs", () => {
    const found = findNearDuplicate({ hook: "Today's small business tip", body: C }, [{ id: "x", hook: "today's small business tip!", body: A }]);
    expect(found?.reason).toBe("same_hook");
  });

  it("lets different posts through", () => {
    expect(findNearDuplicate({ hook: "Plan ahead", body: C }, [{ hook: "Reply fast", body: A }])).toBeNull();
    expect(findNearDuplicate({ hook: null, body: C }, [])).toBeNull();
  });

  it("does not treat very short generic hooks as duplicates", () => {
    expect(findNearDuplicate({ hook: "Tip", body: C }, [{ hook: "Tip", body: A }])).toBeNull();
  });
});

describe("recentHooks", () => {
  it("returns the latest openings in order, falling back to the body", () => {
    const posts = Array.from({ length: 15 }, (_, i) => ({ hook: i % 2 ? null : `Hook ${i}`, body: `Body ${i}` }));
    const hooks = recentHooks(posts, 3);
    expect(hooks).toEqual(["Hook 12", "Body 13", "Hook 14"]);
  });
});
