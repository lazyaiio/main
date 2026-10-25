import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts"));
const rel = (f: string) => relative(SRC, f).split("\\").join("/");

describe("secret handling", () => {
  it("references the Supabase service-role key only in the server-only admin client", () => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes("SUPABASE_SERVICE_ROLE_KEY"));
    expect(offenders.map(rel)).toEqual(["lib/supabase/admin.ts"]);
  });

  it("marks the admin client and server client as server-only", () => {
    for (const path of ["lib/supabase/admin.ts", "lib/supabase/server.ts", "lib/auth/session.ts", "lib/auth/admin.ts", "lib/ai/keys.ts", "lib/media/keys.ts", "lib/social/keys.ts", "lib/data/social.ts", "lib/services/social.ts", "lib/data/publisher.ts", "lib/services/publisher.ts", "lib/data/scheduling.ts", "lib/services/scheduling.ts", "lib/services/data-deletion.ts"]) {
      expect(readFileSync(join(SRC, path), "utf8")).toContain('import "server-only"');
    }
  });

  it("reads AI provider keys only in the server-only keys module", () => {
    const offenders = files.filter((f) => /process\.env\[/.test(readFileSync(f, "utf8")));
    expect(offenders.map(rel)).toEqual(["lib/ai/keys.ts"]);
    expect(readFileSync(join(SRC, "lib/ai/keys.ts"), "utf8")).toContain('import "server-only"');
  });

  it("reads the stock photo key only in the server-only media keys module", () => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes("IMAGE_PROVIDER_API_KEY"));
    expect(offenders.map(rel)).toEqual(["lib/media/keys.ts"]);
  });

  it("reads the Meta app secret and the token encryption key only in the server-only social keys module", () => {
    for (const name of ["META_APP_SECRET", "TOKEN_ENCRYPTION_KEY", "CRON_SECRET", "LIVE_PUBLISHING_ENABLED"]) {
      const offenders = files.filter((f) => readFileSync(f, "utf8").includes(name));
      expect(offenders.map(rel).filter((f) => !f.endsWith(".test.ts"))).toEqual(["lib/social/keys.ts"]);
    }
  });

  it("never logs OAuth codes, tokens, or secrets in the Facebook code", () => {
    const social = files.filter((f) => /(^|\/)(social|services\/(social|publisher|data-deletion)|data\/(social|publisher)|api\/(meta|cron))/.test(rel(f)) && !f.endsWith(".test.ts"));
    expect(social.length).toBeGreaterThan(3);
    for (const f of social) {
      expect(readFileSync(f, "utf8")).not.toMatch(/console\.(log|info|warn|error|debug)\s*\(/);
    }
  });

  it("never exposes a secret through a NEXT_PUBLIC_ variable", () => {
    for (const f of files) {
      expect(readFileSync(f, "utf8")).not.toMatch(/NEXT_PUBLIC_[A-Z_]*(SERVICE|SECRET|PRIVATE)/);
    }
  });

  it("keeps client components away from server-only modules", () => {
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      if (!/^\s*["']use client["']/.test(text)) continue;
      expect(text).not.toMatch(/lib\/supabase\/(admin|server)|lib\/auth\/(session|admin)|lib\/ai\/keys|lib\/media\/keys|lib\/services\/|lib\/data\/db/);
    }
  });
});
