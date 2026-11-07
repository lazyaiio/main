import { NextResponse } from "next/server";
import { isCurrentUserPlatformAdmin } from "@/lib/auth/admin";
import { getAppContext } from "@/lib/auth/session";
import { describeError, logError } from "@/lib/log";
import { exportFilename } from "@/lib/settings-export";
import { buildSettingsExport } from "@/lib/services/settings-export";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** "Download site settings": a JSON copy of plans, pages, SEO and blog text. Platform admins only; everyone else gets a plain 404. */
export async function GET() {
  const ctx = await getAppContext();
  if (!ctx || !(await isCurrentUserPlatformAdmin())) return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  try {
    const file = await buildSettingsExport();
    return new NextResponse(JSON.stringify(file, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename()}"`,
        "X-Content-Type-Options": "nosniff",
        ...NO_STORE,
      },
    });
  } catch (error) {
    logError("admin.settings_export_failed", describeError(error));
    return NextResponse.json({ error: "export_failed" }, { status: 500, headers: NO_STORE });
  }
}
