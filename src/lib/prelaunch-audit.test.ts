import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const rel = (f: string) => relative(ROOT, f).split("\\").join("/");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe("pre-launch audit guards", () => {
  it("enables row level security on every table the migrations create", () => {
    const files = readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql"));
    const created = new Set<string>();
    const secured = new Set<string>();
    for (const f of files) {
      const sql = readFileSync(join(ROOT, "supabase/migrations", f), "utf8");
      for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi)) created.add(m[1]!);
      for (const m of sql.matchAll(/alter\s+table\s+(?:only\s+)?(?:public\.)?"?(\w+)"?\s+enable\s+row\s+level\s+security/gi)) secured.add(m[1]!);
    }
    expect(created.size).toBeGreaterThan(30);
    expect([...created].filter((t) => !secured.has(t))).toEqual([]);
  });

  it("lists every API route with a known way of proving who is calling", () => {
    const routes = walk(join(ROOT, "src/app/api")).filter((f) => f.endsWith("/route.ts")).map(rel).sort();
    const guards: Record<string, string> = {
      "src/app/api/account/export/route.ts": "getAppContext",
      "src/app/api/admin/settings-export/route.ts": "isCurrentUserPlatformAdmin",
      "src/app/api/analytics/collect/route.ts": "public beacon",
      "src/app/api/cron/dispatch/route.ts": "checkCronAuth",
      "src/app/api/email/webhook/route.ts": "verifyWebhook",
      "src/app/api/health/route.ts": "public health check",
      "src/app/api/meta/callback/route.ts": "getAppContext",
      "src/app/api/meta/data-deletion/route.ts": "signed request",
      "src/app/api/meta/deauthorize/route.ts": "signed request",
      "src/app/api/payments/bkash/callback/route.ts": "confirmed with bKash",
    };
    // A new route must be added here on purpose, with a note on how callers are checked.
    expect(routes).toEqual(Object.keys(guards).sort());
    for (const [file, guard] of Object.entries(guards)) {
      if (!/^[a-zA-Z]+$/.test(guard)) continue;
      expect(readFileSync(join(ROOT, file), "utf8"), file).toContain(guard);
    }
  });

  it("keeps Bengali characters out of every source and docs file", () => {
    const files = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "docs"))].filter((f) => /\.(ts|tsx|md|json|sql)$/.test(f));
    const bad = files.filter((f) => /[\u0980-\u09FF]/.test(readFileSync(f, "utf8"))).map(rel);
    expect(bad).toEqual([]);
  });

  it("asks for the patched sharp and Zod releases", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.dependencies.sharp).toBe("^0.35.5");
    expect(pkg.dependencies.zod).toBe("^4.6.7");
    expect(pkg.engines.node).toBe(">=20.9.0");
  });
});
