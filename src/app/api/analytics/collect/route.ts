import { NextResponse, type NextRequest } from "next/server";
import { ingestPageview } from "@/lib/services/analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const quiet = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/** Receives the page view beacon from the public pages. Always answers 204: the browser never needs to know the outcome. */
export async function POST(request: NextRequest) {
  try {
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > 2048) return quiet();
    const text = await request.text();
    if (text.length > 2048) return quiet();
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "";
    const origin = request.headers.get("origin");
    let originHost: string | null = null;
    try {
      originHost = origin ? new URL(origin).hostname.toLowerCase() : null;
    } catch {
      originHost = "invalid.invalid";
    }
    await ingestPageview({
      body: JSON.parse(text),
      userAgent: request.headers.get("user-agent") ?? "",
      ip: forwarded,
      country: request.headers.get("x-vercel-ip-country"),
      originHost,
      ownHost: request.nextUrl.hostname.toLowerCase(),
    });
  } catch {
    // Statistics must never cause an error for visitors.
  }
  return quiet();
}
