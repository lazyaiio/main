import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Source-reading checks for Batch 21 (people, plan emails, settings export). */

const SRC = join(process.cwd(), "src");
const read = (path: string) => readFileSync(join(SRC, path), "utf8");
const MIGRATION = readFileSync(join(process.cwd(), "supabase/migrations/0024_user_management.sql"), "utf8");

describe("user management wiring", () => {
  it("keeps the server-side files server-only", () => {
    for (const path of ["lib/data/users.ts", "lib/services/users.ts", "lib/services/plan-emails.ts", "lib/services/settings-export.ts"]) {
      expect(read(path), path).toContain('import "server-only"');
    }
  });

  it("makes every admin action check for a platform admin first", () => {
    const text = read("app/admin/users/actions.ts");
    const exported = text.match(/export async function \w+/g) ?? [];
    const checks = text.match(/await requirePlatformAdmin\(\)/g) ?? [];
    expect(exported.length).toBeGreaterThan(0);
    expect(checks.length).toBe(exported.length);
  });

  it("protects the admin pages and the export route", () => {
    expect(read("app/admin/users/page.tsx")).toContain("requirePlatformAdmin()");
    expect(read("app/admin/backup/page.tsx")).toContain("requirePlatformAdmin()");
    const route = read("app/api/admin/settings-export/route.ts");
    expect(route).toContain("isCurrentUserPlatformAdmin()");
    expect(route).toContain("404");
  });

  it("refuses to suspend yourself or another platform admin", () => {
    const service = read("lib/services/users.ts");
    expect(service).toContain("userId === adminUserId");
    expect(service).toContain("isPlatformAdminUser(userId)");
  });

  it("lifts Supabase's sign-in block before removing the suspension", () => {
    const service = read("lib/services/users.ts");
    expect(service.indexOf("setSignInBlocked(userId, false)")).toBeGreaterThan(-1);
    expect(service.indexOf("setSignInBlocked(userId, false)")).toBeLessThan(service.indexOf("removeSuspension(userId)"));
  });

  it("shows the suspended screen in the app layout", () => {
    const layout = read("app/app/layout.tsx");
    expect(layout).toContain("SuspendedScreen");
    expect(layout).toContain("isSuspendedSelf");
  });

  it("sends the receipt only when the payment was newly applied, and the plan notices from the scheduler", () => {
    expect(read("lib/services/billing.ts")).toMatch(/if \(applied\) runLater\(\(\) => notifyPaymentReceipt/);
    const cron = read("app/api/cron/dispatch/route.ts");
    expect(cron).toContain("sendEndedNotices(due)");
    expect(cron).toContain("sendEndingSoonNotices()");
    // The ending plans must be read BEFORE expire_plans() runs.
    expect(cron.indexOf("listWorkspacesDueToExpire()")).toBeLessThan(cron.indexOf("await expirePlans()"));
  });

  it("never exports payment or provider credentials", () => {
    const service = read("lib/services/settings-export.ts");
    expect(service).not.toContain("ai_provider_settings");
    expect(service).not.toContain("payments");
    expect(read("lib/settings-export.ts")).not.toMatch(/EXPORTABLE_SETTING_KEYS = \[[^\]]*bkash/);
  });
});

describe("migration 0024", () => {
  it("keeps the suspension table closed to browsers except for their own row", () => {
    expect(MIGRATION).toContain("revoke all on public.account_suspensions from anon, authenticated");
    expect(MIGRATION).toContain("grant select (user_id, suspended_at)");
    expect(MIGRATION).not.toMatch(/grant select on public\.account_suspensions/);
  });
  it("makes the people search service-role only", () => {
    expect(MIGRATION).toContain("grant execute on function public.admin_list_users(text, int, int) to service_role");
    expect(MIGRATION).toContain("_is_service_role()");
  });
  it("blocks writing for suspended accounts and keeps every earlier rule", () => {
    expect(MIGRATION).toContain("public.is_email_verified()");
    expect(MIGRATION).toContain("not public.is_suspended()");
    expect(MIGRATION).toContain("array['owner','admin','editor']");
  });
  it("lists every email template the log accepts", () => {
    for (const name of ["welcome", "verify_email", "campaign_complete", "publish_failed", "page_attention", "support_reply", "payment_receipt", "plan_ending_soon", "plan_ended", "test"]) {
      expect(MIGRATION).toContain(`'${name}'`);
    }
  });
});
