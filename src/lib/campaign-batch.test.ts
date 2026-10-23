import { describe, expect, it } from "vitest";
import { runBatch, type BatchDeps, type BatchSlot, type FailureInfo } from "./campaign-batch";

type Draft = { hook: string | null; body: string };

function slot(index: number): BatchSlot {
  return { id: `slot-${index}`, index, language: "en", format: "tip", theme: null, attempts: 1 };
}

function makeDeps(overrides: Partial<BatchDeps<Draft>> & { slots?: BatchSlot[] } = {}) {
  const log = { released: [] as { id: string; code: string; retry: boolean; refund: boolean }[], saved: [] as string[], discarded: [] as string[], claimedLimit: -1 };
  let clock = 0;
  const slots = overrides.slots ?? [slot(0), slot(1), slot(2)];
  const deps: BatchDeps<Draft> = {
    now: () => clock,
    allowance: 30,
    existing: [],
    claim: async (limit) => {
      log.claimedLimit = limit;
      return slots.slice(0, limit);
    },
    generate: async (s) => {
      clock += 5_000;
      return { hook: `Unique hook number ${s.index}`, body: `Completely different body text ${s.index} alpha${s.index} beta${s.index} gamma${s.index} delta${s.index}` };
    },
    save: async (s) => {
      log.saved.push(s.id);
      return { kind: "saved", itemId: `item-${s.index}` };
    },
    complete: async () => true,
    discard: async (id) => {
      log.discarded.push(id);
    },
    release: async (s, code, options) => {
      log.released.push({ id: s.id, code, ...options });
    },
    classify: (): FailureInfo => ({ code: "ai_failed", retry: true, refund: false, stop: null }),
    ...overrides,
  };
  return { deps, log, tick: (ms: number) => (clock += ms) };
}

describe("runBatch", () => {
  it("saves every claimed slot and never claims more than the per-round maximum", async () => {
    const { deps, log } = makeDeps();
    const summary = await runBatch(deps, { maxSlots: 3, budgetMs: 60_000, minSlotMs: 10_000 });
    expect(summary).toMatchObject({ claimed: 3, saved: 3, failures: 0, duplicates: 0, returned: 0, stop: null });
    expect(log.claimedLimit).toBe(3);
    expect(deps.existing).toHaveLength(3);
  });

  it("claims no more than the hourly allowance", async () => {
    const { deps, log } = makeDeps({ allowance: 2 });
    const summary = await runBatch(deps, { maxSlots: 3, budgetMs: 60_000, minSlotMs: 10_000 });
    expect(log.claimedLimit).toBe(2);
    expect(summary.claimed).toBe(2);
  });

  it("stops without claiming anything when the hourly limit is used up", async () => {
    const { deps, log } = makeDeps({ allowance: 0 });
    const summary = await runBatch(deps);
    expect(summary.stop).toBe("rate_limited");
    expect(summary.claimed).toBe(0);
    expect(log.claimedLimit).toBe(-1);
  });

  it("keeps successful posts when one slot fails (partial failure)", async () => {
    let calls = 0;
    const { deps, log } = makeDeps({
      generate: async (s) => {
        calls++;
        if (s.index === 1) throw new Error("boom");
        return { hook: `Hook ${s.index} unique`, body: `Body ${s.index} one${s.index} two${s.index} three${s.index} four${s.index}` };
      },
    });
    const summary = await runBatch(deps, { maxSlots: 3, budgetMs: 60_000, minSlotMs: 1 });
    expect(calls).toBe(3);
    expect(summary.saved).toBe(2);
    expect(summary.failures).toBe(1);
    expect(log.released).toEqual([{ id: "slot-1", code: "ai_failed", retry: true, refund: false }]);
    expect(deps.existing).toHaveLength(2);
  });

  it("rejects near-duplicates and sends the slot back for another try", async () => {
    const { deps, log } = makeDeps({
      existing: [{ hook: "Reply fast", body: "Reply to every customer comment within one day so people know you are listening." }],
      generate: async () => ({ hook: "Another hook entirely", body: "Reply to every customer comment within one day so people know you are listening!" }),
    });
    const summary = await runBatch(deps, { maxSlots: 1, budgetMs: 60_000, minSlotMs: 1 });
    expect(summary.duplicates).toBe(1);
    expect(summary.saved).toBe(0);
    expect(log.saved).toEqual([]);
    expect(log.released).toEqual([{ id: "slot-0", code: "duplicate", retry: true, refund: false }]);
  });

  it("treats a database duplicate (same wording hash) the same way", async () => {
    const { deps, log } = makeDeps({ save: async () => ({ kind: "duplicate" }) });
    const summary = await runBatch(deps, { maxSlots: 1, budgetMs: 60_000, minSlotMs: 1 });
    expect(summary.duplicates).toBe(1);
    expect(log.released[0]).toMatchObject({ code: "duplicate", retry: true });
  });

  it("stops starting new slots when time is nearly up and returns the unused ones without spending attempts", async () => {
    const { deps, log } = makeDeps({
      generate: async (s) => {
        // Each slot takes 20 seconds of a 45 second budget.
        (deps as unknown as { tick: (ms: number) => void }).tick?.(0);
        return { hook: `H ${s.index} unique`, body: `B ${s.index} one${s.index} two${s.index} three${s.index} four${s.index}` };
      },
    });
    let clock = 0;
    deps.now = () => clock;
    deps.generate = async (s) => {
      clock += 20_000;
      return { hook: `H ${s.index} unique`, body: `B ${s.index} one${s.index} two${s.index} three${s.index} four${s.index}` };
    };
    const summary = await runBatch(deps, { maxSlots: 3, budgetMs: 45_000, minSlotMs: 15_000 });
    expect(summary.saved).toBe(2); // starts at 0 s and 20 s; at 40 s only 5 s remain
    expect(summary.returned).toBe(1);
    expect(log.released).toEqual([{ id: "slot-2", code: "out_of_time", retry: true, refund: true }]);
  });

  it("stops the round on a setup problem and hands back the remaining slots", async () => {
    const { deps, log } = makeDeps({
      generate: async () => {
        throw new Error("no key");
      },
      classify: () => ({ code: "not_configured", retry: true, refund: true, stop: "not_configured" }),
    });
    const summary = await runBatch(deps, { maxSlots: 3, budgetMs: 60_000, minSlotMs: 1 });
    expect(summary.stop).toBe("not_configured");
    expect(summary.failures).toBe(1);
    expect(summary.returned).toBe(2);
    expect(log.released.every((r) => r.refund && r.retry)).toBe(true);
    expect(log.released).toHaveLength(3);
  });

  it("deletes the post when the campaign was canceled while the AI was writing", async () => {
    const { deps, log } = makeDeps({ complete: async () => false });
    const summary = await runBatch(deps, { maxSlots: 1, budgetMs: 60_000, minSlotMs: 1 });
    expect(summary.saved).toBe(0);
    expect(log.discarded).toEqual(["item-0"]);
    expect(deps.existing).toHaveLength(0);
  });

  it("does not let a failing release crash the round", async () => {
    const { deps } = makeDeps({
      generate: async () => {
        throw new Error("boom");
      },
      release: async () => {
        throw new Error("database down");
      },
    });
    const summary = await runBatch(deps, { maxSlots: 2, budgetMs: 60_000, minSlotMs: 1 });
    expect(summary.failures).toBe(2);
  });

  it("passes recent hooks to the generator so it can avoid repeating them", async () => {
    const seen: string[][] = [];
    const { deps } = makeDeps({
      existing: [{ hook: "Earlier hook", body: "Earlier body text for the campaign" }],
      generate: async (s, context) => {
        seen.push(context.avoidHooks);
        return { hook: `Fresh ${s.index} hook`, body: `Fresh ${s.index} wording one${s.index} two${s.index} three${s.index} four${s.index}` };
      },
    });
    await runBatch(deps, { maxSlots: 2, budgetMs: 60_000, minSlotMs: 1 });
    expect(seen[0]).toEqual(["Earlier hook"]);
    expect(seen[1]).toEqual(["Earlier hook", "Fresh 0 hook"]);
  });
});
