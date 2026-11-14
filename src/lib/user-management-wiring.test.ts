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

describe("lifetime deal wiring", () => {
  it("keeps the server-side files server-only", () => {
    for (const path of ["lib/data/lifetime-deal.ts", "lib/services/lifetime-deal.ts"]) expect(read(path), path).toContain('import "server-only"');
  });
  it("shows the deal in the header, home page, pricing page and checkout", () => {
    expect(read("app/(marketing)/layout.tsx")).toContain("loadLifetimeOffer()");
    expect(read("components/marketing/site-header.tsx")).toContain("LifetimeDealPill");
    expect(read("app/(marketing)/page.tsx")).toContain("LifetimeDealStrip");
    expect(read("app/(marketing)/pricing/page.tsx")).toContain("LifetimeDealBanner");
    expect(read("app/(marketing)/checkout/page.tsx")).toContain("loadLifetimeOffer()");
  });
  it("lets only platform admins save the deal", () => {
    const text = read("app/admin/plans/actions.ts");
    const fn = text.slice(text.indexOf("export async function saveLifetimeDealAction"));
    expect(fn.indexOf("requirePlatformAdmin()")).toBeGreaterThan(-1);
    expect(fn.indexOf("requirePlatformAdmin()")).toBeLessThan(fn.indexOf("saveLifetimeDeal("));
  });
  it("closes lifetime sales from the scheduler when the end date passes", () => {
    expect(read("app/api/cron/dispatch/route.ts")).toContain("closeEndedLifetimeDeal()");
    expect(read("lib/services/lifetime-deal.ts")).toContain("closeLifetimeSales()");
  });
  it("never advertises a deal that cannot be bought", () => {
    const lib = read("lib/lifetime-deal.ts");
    expect(lib).toContain("lifetime_available");
    expect(lib).toContain("checkoutOpen(currency)");
  });
});

describe("launch checklist, Meta review and tools wiring", () => {
  it("keeps the server-side files server-only", () => {
    for (const path of ["lib/data/launch.ts", "lib/services/launch.ts", "lib/services/meta-review.ts"]) expect(read(path), path).toContain('import "server-only"');
  });
  it("protects the new admin pages and the checklist action", () => {
    expect(read("app/admin/launch/page.tsx")).toContain("requirePlatformAdmin()");
    expect(read("app/admin/meta-review/page.tsx")).toContain("requirePlatformAdmin()");
    expect(read("app/admin/launch/actions.ts")).toContain("await requirePlatformAdmin()");
  });
  it("lets the checklist action change only known manual items", () => {
    expect(read("app/admin/launch/actions.ts")).toContain("isManualId(id)");
    expect(read("lib/data/launch.ts")).toContain("isManualId(id)");
  });
  it("adds the new pages to the admin menu", () => {
    const nav = read("components/admin/admin-nav.tsx");
    expect(nav).toContain('"/admin/launch"');
    expect(nav).toContain('"/admin/meta-review"');
  });
  it("registers every new tool for search, and lists it on the tools page", () => {
    const seo = read("lib/seo.ts");
    const index = read("app/(marketing)/tools/page.tsx");
    for (const path of ["/tools/engagement-rate-calculator", "/tools/utm-link-builder", "/tools/hashtag-cleaner", "/tools/giveaway-winner-picker", "/tools/time-zone-converter", "/tools/follower-growth-calculator"]) {
      expect(seo, path).toContain(`path: "${path}"`);
      expect(index, path).toContain(path);
      expect(read(`app${"/(marketing)"}${path}/page.tsx`), path).toContain("ToolShell");
    }
  });
});

describe("Page Insights wiring", () => {
  it("keeps the server-side files server-only", () => {
    for (const path of ["lib/data/insights.ts", "lib/services/insights.ts"]) expect(read(path), path).toContain('import "server-only"');
  });
  it("lets only writers refresh, rate-limits refreshes, and respects the cooldown", () => {
    const text = read("lib/services/insights.ts");
    expect(text).toContain("canWrite(ctx.role)");
    expect(text).toContain('enforceRate(db, "insights_refresh"');
    expect(text).toContain("canRefresh(");
    expect(text.indexOf("insightsAccess(")).toBeLessThan(text.indexOf("getSocialProvider()"));
  });
  it("never requires read_insights to connect, so older connections keep working", () => {
    expect(read("lib/social/meta-provider.ts")).toContain("requiredScopes: META_REQUIRED_SCOPES");
    expect(read("lib/social/meta-provider.ts")).not.toMatch(/META_REQUIRED_SCOPES = \[[^\]]*read_insights/);
  });
  it("deletes saved Insights when a Page is disconnected or Facebook data is deleted", () => {
    const text = read("lib/data/social.ts");
    expect((text.match(/page_insight_snapshots/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
  it("shows Insights in the app menu and checks the signed-in person on the page and action", () => {
    expect(read("components/app/app-nav.tsx")).toContain('"/app/insights"');
    expect(read("app/app/insights/page.tsx")).toContain("requireAppContext()");
    expect(read("app/app/insights/actions.ts")).toContain("requireAppContext()");
  });
  it("tells people in the Privacy Policy about Insights", () => {
    const text = read("content/default-pages.ts");
    expect(text).toContain("read_insights");
    expect(text).toContain("saved Insights numbers");
  });
  it("keeps secrets out of what is saved", () => {
    expect(read("lib/services/insights.ts")).not.toMatch(/token:\s*token|accessToken:\s*cipher/);
  });
});

