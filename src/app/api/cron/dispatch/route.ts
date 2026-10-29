import { NextResponse, type NextRequest } from "next/server";
import { checkCronAuth } from "@/lib/publish-dispatch";
import { runBackgroundCampaigns } from "@/lib/services/campaign-worker";
import { dispatchDuePosts } from "@/lib/services/publisher";
import { describeError, logError } from "@/lib/log";
import { getCronSecret } from "@/lib/social/keys";

export const dynamic = "force-dynamic";
// Publishing a few posts can take a while (image download, Facebook).
export const maxDuration = 60;

/**
 * The scheduler calls this every minute (see docs/SCHEDULER_SETUP.md). It publishes the posts that are
 * due. It refuses every request that does not carry the secret in "Authorization: Bearer <secret>",
 * and refuses everything when no secret is configured. The answer contains only counts.
 */
async function handle(request: NextRequest) {
  const auth = checkCronAuth(request.headers.get("authorization"), getCronSecret());
  if (auth !== "ok") {
    // "reason" tells the person setting up the scheduler which side is wrong (see docs/SCHEDULER_SETUP.md).
    return NextResponse.json({ error: "unauthorized", reason: auth }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const startedAt = Date.now();
  try {
    const summary = await dispatchDuePosts();
    // Then keep campaigns that are being written moving, with whatever time is left of the 60 seconds.
    // A problem here must never hide the publishing result.
    let writing = { campaigns: 0, saved: 0, failures: 0 };
    try {
      writing = await runBackgroundCampaigns(54_000 - (Date.now() - startedAt));
    } catch (error) {
      logError("cron.campaigns_failed", describeError(error));
    }
    return NextResponse.json({ ok: true, ...summary, writing }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logError("cron.dispatch_failed", describeError(error));
    return NextResponse.json({ ok: false, error: "dispatch_failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = handle;
export const POST = handle;
