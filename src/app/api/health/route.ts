export const dynamic = "force-dynamic";

/** Liveness check. Must never include secrets or environment details. */
export function GET() {
  return Response.json(
    { status: "ok", service: "lazyai", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
