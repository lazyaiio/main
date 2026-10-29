import { findNearDuplicate, recentHooks, type Comparable } from "@/lib/similarity";

/**
 * One small, bounded round of campaign generation.
 *
 * This file holds only the decision logic. Everything that touches the database or the AI is
 * passed in (see services/campaigns.ts), which keeps the rules testable without a network:
 *  - never more slots than the rate-limit allowance and the per-round maximum
 *  - stop starting new slots when the time budget is nearly used up
 *  - a failed slot never loses the posts that were already saved
 *  - repeated wording is rejected and retried, then failed after the attempt limit
 *  - setup problems (no AI key, hourly limit) stop the round and return unused slots untouched
 */

export type BatchSlot = {
  id: string;
  index: number;
  language: "en" | "bn";
  format: string;
  theme: string | null;
  /** When the post is planned to go out (ISO), if known. */
  plannedAt?: string;
  /** How many times this slot has been claimed, including this round. */
  attempts: number;
};

export type FailureInfo = {
  /** Short machine code stored on the slot (lowercase letters and underscores). */
  code: string;
  retry: boolean;
  /** Do not count this attempt against the slot (the problem was not the slot's fault). */
  refund: boolean;
  /** Stop the whole round after this failure. */
  stop: "rate_limited" | "not_configured" | "plan_limit" | null;
};

export type SaveResult = { kind: "saved"; itemId: string } | { kind: "duplicate" };

export type BatchDeps<T extends Comparable> = {
  now: () => number;
  /** How many generations the hourly limit still allows. */
  allowance: number;
  /** Posts already in the campaign. Updated as new posts are saved. */
  existing: Comparable[];
  claim: (limit: number) => Promise<BatchSlot[]>;
  generate: (slot: BatchSlot, context: { avoidHooks: string[]; remainingMs: number }) => Promise<T>;
  save: (slot: BatchSlot, draft: T) => Promise<SaveResult>;
  complete: (slot: BatchSlot, itemId: string) => Promise<boolean>;
  discard: (itemId: string) => Promise<void>;
  release: (slot: BatchSlot, code: string, options: { retry: boolean; refund: boolean }) => Promise<void>;
  classify: (error: unknown) => FailureInfo;
};

export type BatchOptions = {
  /** Most slots handled in one round. */
  maxSlots: number;
  /** Total time the round may use. */
  budgetMs: number;
  /** A new slot is only started when at least this much time is left. */
  minSlotMs: number;
};

export type BatchSummary = {
  claimed: number;
  saved: number;
  duplicates: number;
  failures: number;
  /** Slots handed back without trying (out of time, or the round was stopped). */
  returned: number;
  stop: "rate_limited" | "not_configured" | "plan_limit" | null;
};

export const DEFAULT_BATCH_OPTIONS: BatchOptions = { maxSlots: 3, budgetMs: 45_000, minSlotMs: 15_000 };

export async function runBatch<T extends Comparable>(deps: BatchDeps<T>, options: BatchOptions = DEFAULT_BATCH_OPTIONS): Promise<BatchSummary> {
  const summary: BatchSummary = { claimed: 0, saved: 0, duplicates: 0, failures: 0, returned: 0, stop: null };
  const startedAt = deps.now();

  const limit = Math.min(options.maxSlots, Math.floor(deps.allowance));
  if (limit <= 0) {
    summary.stop = "rate_limited";
    return summary;
  }

  const slots = await deps.claim(limit);
  summary.claimed = slots.length;

  // Hands a slot back without spending one of its attempts. A failure here is harmless:
  // the slot's lease simply runs out and the slot is offered again.
  const giveBack = async (slot: BatchSlot, code: string) => {
    summary.returned++;
    try {
      await deps.release(slot, code, { retry: true, refund: true });
    } catch {
      // lease expiry recovers it
    }
  };

  for (const slot of slots) {
    if (summary.stop) {
      await giveBack(slot, summary.stop);
      continue;
    }
    const remainingMs = options.budgetMs - (deps.now() - startedAt);
    if (remainingMs < options.minSlotMs) {
      await giveBack(slot, "out_of_time");
      continue;
    }

    try {
      const draft = await deps.generate(slot, { avoidHooks: recentHooks(deps.existing), remainingMs });

      const repeated = findNearDuplicate(draft, deps.existing);
      if (repeated) {
        summary.duplicates++;
        await deps.release(slot, "duplicate", { retry: true, refund: false });
        continue;
      }

      const saved = await deps.save(slot, draft);
      if (saved.kind === "duplicate") {
        summary.duplicates++;
        await deps.release(slot, "duplicate", { retry: true, refund: false });
        continue;
      }

      const accepted = await deps.complete(slot, saved.itemId);
      if (!accepted) {
        // The campaign was canceled while the AI was writing. Do not keep a post nobody asked for.
        await deps.discard(saved.itemId);
        continue;
      }
      deps.existing.push({ id: saved.itemId, hook: draft.hook, body: draft.body });
      summary.saved++;
    } catch (error) {
      const info = deps.classify(error);
      summary.failures++;
      try {
        await deps.release(slot, info.code, { retry: info.retry, refund: info.refund });
      } catch {
        // lease expiry recovers it
      }
      if (info.stop) summary.stop = info.stop;
    }
  }

  return summary;
}
