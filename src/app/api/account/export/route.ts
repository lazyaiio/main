import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/auth/session";
import { describeError, logError } from "@/lib/log";
import { ServiceError } from "@/lib/services/errors";
import { buildAccountExport } from "@/lib/services/account";

export const dynamic = "force-dynamic";

/** "Download my data": a JSON file with the signed-in person's own data. Needs a signed-in session. */
export async function GET() {
  const ctx = await getAppContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const file = await buildAccountExport(ctx);
    return new NextResponse(file.json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ServiceError && error.kind === "too_many_requests") {
      return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "3600" } });
    }
    logError("account.export_failed", describeError(error));
    return NextResponse.json({ error: "export_failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
