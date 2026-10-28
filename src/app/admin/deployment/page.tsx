import type { Metadata } from "next";
import { headers } from "next/headers";
import { CheckCircle2, CircleAlert, CircleX, MinusCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireAppContext } from "@/lib/auth/session";
import { getDb } from "@/lib/data/db";
import {
  MIGRATION_PROBES,
  SMOKE_PAGES,
  checkAppAddress,
  checkSettings,
  deploymentEnvironment,
  effectiveAppUrl,
  interpretProbe,
  registrationAddresses,
  type CheckState,
  type DeployCheck,
  type ProbeResult,
} from "@/lib/deployment-checks";

export const metadata: Metadata = { title: "Deployment" };
export const dynamic = "force-dynamic";

function Icon({ state }: { state: CheckState }) {
  if (state === "ok") return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="OK" />;
  if (state === "warn") return <CircleAlert className="h-5 w-5 shrink-0 text-amber-600" aria-label="Needs attention" />;
  if (state === "bad") return <CircleX className="h-5 w-5 shrink-0 text-red-600" aria-label="Problem" />;
  return <MinusCircle className="h-5 w-5 shrink-0 text-ink-300" aria-label="Not in use" />;
}

function CheckRow({ check }: { check: DeployCheck }) {
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <Icon state={check.state} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{check.label}</p>
        <p className="text-sm text-ink-600">{check.detail}</p>
      </div>
    </li>
  );
}

export default async function DeploymentPage() {
  await requireAppContext();
  const source = process.env as Record<string, string | undefined>;
  const environment = deploymentEnvironment(source);
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  const checks = [...checkAppAddress(source, requestHost), ...checkSettings(source)];
  const groups = Array.from(new Set(checks.map((c) => c.group)));
  const addresses = registrationAddresses(source);
  const appUrl = effectiveAppUrl(source);

  // Read zero rows from one table per migration. A missing table means that migration was never run.
  const db = await getDb();
  const probes: { migration: string; table: string; result: ProbeResult }[] = await Promise.all(
    MIGRATION_PROBES.map(async ({ migration, table }) => {
      try {
        const { error } = await db.from(table).select("*", { head: true, count: "exact" }).limit(1);
        return { migration, table, result: interpretProbe(error) };
      } catch {
        return { migration, table, result: "unknown" as ProbeResult };
      }
    }),
  );

  const problems = checks.filter((c) => c.state === "bad").length + probes.filter((p) => p.result === "missing").length;
  const warnings = checks.filter((c) => c.state === "warn").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Deployment"
        description="Check that this site is set up correctly, and copy the addresses other services need. Only whether a setting exists is shown, never its value."
      />

      <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <p className="text-sm text-ink-600">
          Environment: <strong className="text-ink">{environment}</strong> · App address: <strong className="text-ink">{appUrl}</strong>
        </p>
        <p className="mt-2 text-sm font-semibold">
          {problems === 0 && warnings === 0
            ? "Everything looks ready."
            : `${problems} problem${problems === 1 ? "" : "s"} and ${warnings} item${warnings === 1 ? "" : "s"} to look at.`}
        </p>
      </section>

      {groups.map((group) => (
        <section key={group} className="space-y-2">
          <h2 className="font-display text-lg font-bold">{group}</h2>
          <ul className="rounded-2xl border border-ink-100 bg-white shadow-card divide-y divide-ink-100">
            {checks
              .filter((c) => c.group === group)
              .map((c) => (
                <CheckRow key={c.id} check={c} />
              ))}
          </ul>
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold">Database setup</h2>
        <p className="text-sm text-ink-600">
          Looks for one table from each SQL file. Files 0006 to 0010 only add rules and functions, so they are covered by the SQL tests in the docs folder instead.
        </p>
        <ul className="rounded-2xl border border-ink-100 bg-white shadow-card divide-y divide-ink-100">
          {probes.map((p) => (
            <CheckRow
              key={p.migration}
              check={{
                id: p.migration,
                group: "Database setup",
                label: `Migration ${p.migration} (table ${p.table})`,
                state: p.result === "present" ? "ok" : p.result === "missing" ? "bad" : "warn",
                detail:
                  p.result === "present"
                    ? "Found."
                    : p.result === "missing"
                      ? `Not found. Run supabase/migrations/${p.migration}_*.sql in the Supabase SQL Editor.`
                      : "Could not be checked. Try again, or confirm in the Supabase table list.",
              }}
            />
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold">Addresses to register elsewhere</h2>
        <p className="text-sm text-ink-600">Built from the app address above. Whenever the domain changes, update each of these.</p>
        <ul className="rounded-2xl border border-ink-100 bg-white shadow-card divide-y divide-ink-100">
          {addresses.map((a) => (
            <li key={a.label} className="px-5 py-3">
              <p className="text-sm font-semibold">{a.label}</p>
              <code className="mt-1 block break-all rounded bg-ink-50 px-2 py-1 text-sm">{a.value}</code>
              <p className="mt-1 text-xs text-ink-500">{a.where}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold">After every production deploy, open these</h2>
        <ul className="rounded-2xl border border-ink-100 bg-white shadow-card divide-y divide-ink-100">
          {SMOKE_PAGES.map((p) => (
            <li key={p.href} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <a href={p.href} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">
                {p.href}
              </a>
              <span className="text-ink-600">{p.expect}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
