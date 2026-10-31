import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPublicEnv } from "@/lib/env";
import { finishCheckout } from "@/lib/services/billing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const query = z.object({
  pid: z.string().uuid(),
  paymentID: z.string().min(5).max(80).regex(/^[A-Za-z0-9_-]+$/),
  status: z.enum(["success", "failure", "cancel"]),
});

/** bKash sends the customer here after paying (or giving up). The result is confirmed with bKash, not read from the address. */
export async function GET(request: NextRequest) {
  const base = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const go = (search: string) => NextResponse.redirect(`${base}/app/billing?${search}`, { status: 303, headers: { "Cache-Control": "no-store" } });

  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return go("error=invalid");
  try {
    const outcome = await finishCheckout(parsed.data.pid, parsed.data.paymentID, parsed.data.status);
    return outcome === "paid" ? NextResponse.redirect(`${base}/app?notice=paid`, { status: 303, headers: { "Cache-Control": "no-store" } }) : go(`error=${outcome}`);
  } catch {
    return go("error=unknown");
  }
}
