import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Source-reading checks for Batch 20 (support inbox, announcement banner, maintenance mode). */

const SRC = join(process.cwd(), "src");
const read = (path: string) => readFileSync(join(SRC, path), "utf8");

describe("support inbox wiring", () => {
  it("keeps the server-side files server-only", () => {
    for (const path of ["lib/data/support.ts", "lib/services/support.ts", "lib/data/notices.ts", "lib/services/notices.ts"]) {
      expect(read(path), path).toContain('import "server-only"');
    }
  });

  it("makes every admin action check for a platform admin first", () => {
    for (const path of ["app/admin/support/actions.ts", "app/admin/notices/actions.ts"]) {
      const text = read(path);
      const exported = text.match(/export async function \w+/g) ?? [];
      const checks = text.match(/await requirePlatformAdmin\(\)/g) ?? [];
      expect(exported.length, path).toBeGreaterThan(0);
      expect(checks.length, path).toBe(exported.length);
    }
  });

  it("protects the admin pages", () => {
    expect(read("app/admin/support/page.tsx")).toContain("requirePlatformAdmin()");
    expect(read("app/admin/notices/page.tsx")).toContain("requirePlatformAdmin()");
  });

  it("has the hidden spam box and the server timestamp in the contact form, and never saves a raw address", () => {
    const form = read("components/marketing/contact-form.tsx");
    expect(form).toContain('name="website"');
    expect(form).toContain('name="startedAt"');
    expect(form).toContain('tabIndex={-1}');
    const service = read("lib/services/support.ts");
    expect(service).toContain("visitorHash");
    expect(service).not.toMatch(/ip:\s*meta\.ip,?\s*\n/);
    const data = read("lib/data/support.ts");
    expect(data).not.toMatch(/\bip:/);
  });

  it("sends a reply only from the admin action (the public action never sends email)", () => {
    expect(read("app/(marketing)/contact/actions.ts")).not.toContain("sendSupportReply");
    expect(read("app/admin/support/actions.ts")).toContain("sendSupportReply");
  });

  it("has a migration with row security on and no policies, and a matching SQL test", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/0023_support_inbox.sql"), "utf8");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on public.support_messages from anon, authenticated");
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).toContain("grant execute on function public.support_can_submit(text, text) to service_role");
    expect(existsSync(join(process.cwd(), "supabase/tests/rls_support.sql"))).toBe(true);
  });

  it("links the public Contact page to the form", () => {
    expect(read("app/(marketing)/contact/page.tsx")).toContain("<ContactForm");
  });
});

describe("announcement banner and maintenance mode wiring", () => {
  it("shows the banner on the public site and in the app", () => {
    expect(read("app/(marketing)/layout.tsx")).toContain("AnnouncementBanner");
    expect(read("app/app/layout.tsx")).toContain("AnnouncementBanner");
  });

  it("lets platform admins through maintenance mode (so they can switch it off)", () => {
    const layout = read("app/app/layout.tsx");
    expect(layout).toMatch(/maintenance\.enabled && !isAdmin/);
    expect(layout).toContain("MaintenanceScreen");
  });

  it("does not block the public site, the scheduler, or the admin area in maintenance mode", () => {
    expect(read("app/api/cron/dispatch/route.ts")).not.toContain("maintenance");
    expect(read("app/admin/layout.tsx")).not.toContain("maintenance");
    expect(read("app/(marketing)/layout.tsx")).not.toContain("maintenance.enabled");
  });

  it("opens outside links safely", () => {
    const banner = read("components/site/announcement-banner.tsx");
    expect(banner).toContain('target="_blank" rel="noopener noreferrer"');
  });
});
