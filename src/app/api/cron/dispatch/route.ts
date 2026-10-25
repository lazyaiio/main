import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/publish-dispatch";
import { dispatchDuePosts } from "@/lib/services/publisher";
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
  if (!isAuthorizedCron(request.headers.get("authorization"), getCronSecret())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const summary = await dispatchDuePosts();
    return NextResponse.json({ ok: true, ...summary }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "dispatch_failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = handle;
export const POST = handle;
