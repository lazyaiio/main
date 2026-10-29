"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { runCampaignBatchAction } from "@/app/app/campaigns/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { campaignStatus } from "@/lib/status";
import type { CampaignStatus } from "@/lib/data/types";

export type RunnerState = {
  status: CampaignStatus;
  total: number;
  completed: number;
  failed: number;
  remaining: number;
  keepGoing: boolean;
  message: string | null;
};

const PAUSE_BETWEEN_ROUNDS_MS = 400;

/**
 * Progress panel. While the campaign is "generating" and this page is open, it asks the server
 * for one small round of posts at a time (a few posts per request, never the whole campaign).
 * All progress is stored in the database, so closing the page only pauses the work.
 */
export function CampaignRunner({ campaignId, initial, canRun, backgroundActive }: { campaignId: string; initial: RunnerState; canRun: boolean; backgroundActive: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<RunnerState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [halted, setHalted] = useState(false);
  const [working, setWorking] = useState(false);

  const shouldRun = canRun && state.status === "generating" && !halted;

  useEffect(() => {
    if (!shouldRun) return;
    let cancelled = false;

    (async () => {
      setWorking(true);
      while (!cancelled) {
        const result = await runCampaignBatchAction(campaignId);
        if (cancelled) break;
        if (!result.ok) {
          setError(result.error);
          setHalted(true);
          break;
        }
        setError(null);
        setState(result.state);
        router.refresh(); // keeps the plan table below up to date
        if (!result.state.keepGoing) break;
        await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_ROUNDS_MS));
      }
      if (!cancelled) setWorking(false);
    })();

    return () => {
      cancelled = true;
      setWorking(false);
    };
  }, [shouldRun, campaignId, router]);

  const total = state.total;
  const percent = total > 0 ? Math.min(100, Math.round((state.completed / total) * 100)) : 0;
  const meta = campaignStatus[state.status];
  const generating = state.status === "generating";

  return (
    <section aria-label="Progress" className="space-y-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Progress</h2>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Posts written"
        >
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-sm font-semibold text-ink-700">
          {state.completed} of {total}
        </span>
      </div>

      <p className="text-sm text-ink-600" aria-live="polite">
        {state.completed} written
        {state.failed > 0 ? ` · ${state.failed} failed` : ""}
        {state.remaining > 0 ? ` · ${state.remaining} to go` : ""}
        {generating && working ? " · writing the next posts…" : ""}
      </p>

      {generating && canRun ? (
        <p className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-700" role="status">
          {backgroundActive
            ? "Posts keep being written in the background, a few every minute, even if you close this page. Keeping it open just makes it faster."
            : "Posts are written in small batches while this page is open. If you close it, your progress is saved and you can continue later. (Writing in the background needs the every-minute scheduler. An admin can check it under Admin, Publishing.)"}
        </p>
      ) : null}
      {generating && !canRun ? (
        <p className="rounded-xl bg-ink-50 px-3.5 py-2.5 text-sm text-ink-600" role="status">
          This campaign is being written by someone with edit access.
        </p>
      ) : null}

      {state.message ? (
        <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          {state.message}
        </p>
      ) : null}

      {error ? (
        <div role="alert" className="space-y-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <p>{error}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setError(null);
              setHalted(false);
            }}
          >
            Try again
          </Button>
        </div>
      ) : null}
    </section>
  );
}
