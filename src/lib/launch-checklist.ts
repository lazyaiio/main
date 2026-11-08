/** The go-live checklist (pure: no database, no network). Automatic items are computed from facts the site can read; manual items are ticked by the owner. */

export type LaunchFacts = {
  environment: "production" | "preview" | "development";
  appUrlIsHttps: boolean;
  deployProblems: number;
  deployWarnings: number;
  missingMigrations: string[];
  contactEmailSet: boolean;
  operatorNameSet: boolean;
  operatorCountrySet: boolean;
  emailSendingReady: boolean;
  emailWebhookReady: boolean;
  paidPlansWithPrice: number;
  bkashReady: boolean;
  bkashMode: "sandbox" | "live" | null;
  socialMode: "meta" | "mock" | "off";
  socialReady: boolean;
  liveFlagOn: boolean;
  publishingBlockedByEnv: boolean;
  cronSecretSet: boolean;
  heartbeatAgeMinutes: number | null;
  publishedBlogPosts: number;
};

export type ItemState = "ok" | "todo" | "warn";
export type LaunchItem = {
  id: string;
  group: string;
  title: string;
  kind: "auto" | "manual";
  /** A required item that is not done blocks "ready to launch". */
  required: boolean;
  /** Where to fix or learn more (an admin page or a document). */
  where: string;
};

export const LAUNCH_ITEMS: LaunchItem[] = [
  // Site basics
  { id: "site-production", group: "Site basics", title: "Running as the live production site on a secure address", kind: "auto", required: true, where: "Admin -> Deployment" },
  { id: "site-deploy-checks", group: "Site basics", title: "No problems on the Deployment page", kind: "auto", required: true, where: "Admin -> Deployment" },
  { id: "site-migrations", group: "Site basics", title: "Every database migration has been run", kind: "auto", required: true, where: "docs/SUPABASE_SETUP.md" },
  { id: "site-legal-details", group: "Site basics", title: "Support email, business name and country are set (shown in the legal pages)", kind: "auto", required: true, where: "Vercel settings (docs/META_APP_REVIEW.md, section 1)" },
  { id: "site-smoke", group: "Site basics", title: "Walked through the live site by hand (sign-up, post, schedule, billing)", kind: "manual", required: true, where: "docs/RELEASE_CHECKLIST.md, section 2" },
  // Money
  { id: "money-plans", group: "Money", title: "At least one paid plan has a price", kind: "auto", required: true, where: "Admin -> Plans" },
  { id: "money-bkash", group: "Money", title: "bKash credentials are saved and payments are switched on", kind: "auto", required: true, where: "Admin -> Payments" },
  { id: "money-bkash-live", group: "Money", title: "bKash is in live mode (not sandbox)", kind: "auto", required: true, where: "Admin -> Payments" },
  { id: "money-sandbox-test", group: "Money", title: "Completed a sandbox payment and checked the plan, receipt email and invoice", kind: "manual", required: true, where: "docs/PAYMENTS_SETUP.md" },
  { id: "money-live-test", group: "Money", title: "Made one small real payment, then refunded it", kind: "manual", required: true, where: "docs/PAYMENTS_SETUP.md" },
  // Email
  { id: "email-sending", group: "Email", title: "Email sending is configured (Resend key and sender address)", kind: "auto", required: true, where: "Admin -> Email" },
  { id: "email-webhook", group: "Email", title: "Delivery tracking (Resend webhook) is configured", kind: "auto", required: false, where: "Admin -> Email" },
  { id: "email-inbox", group: "Email", title: "A test email reached a real inbox, not the spam folder", kind: "manual", required: true, where: "docs/EMAIL_SETUP.md" },
  // Publishing
  { id: "pub-facebook", group: "Publishing", title: "Facebook connection is set up for real (not test mode)", kind: "auto", required: true, where: "Admin -> Publishing" },
  { id: "pub-live-flag", group: "Publishing", title: "Live publishing is switched on", kind: "auto", required: true, where: "Admin -> Publishing" },
  { id: "pub-scheduler", group: "Publishing", title: "The scheduler is running (a check-in in the last 10 minutes)", kind: "auto", required: true, where: "docs/SCHEDULER_SETUP.md" },
  { id: "pub-test-post", group: "Publishing", title: "Published and then deleted one test post on a real Facebook Page", kind: "manual", required: true, where: "docs/RELEASE_CHECKLIST.md, section 3" },
  // Content and search
  { id: "seo-blog", group: "Content and search", title: "At least 7 blog articles are published", kind: "auto", required: false, where: "Admin -> Blog" },
  { id: "seo-search-console", group: "Content and search", title: "Sitemap submitted in Google Search Console", kind: "manual", required: false, where: "docs/SEO_SETUP.md" },
  // Legal and approvals
  { id: "legal-lawyer", group: "Legal and approvals", title: "A lawyer has read the Privacy Policy, Terms and Acceptable Use Policy", kind: "manual", required: true, where: "Admin -> Pages" },
  { id: "legal-lifetime", group: "Legal and approvals", title: "The Terms say what \"lifetime\" means for the plans you sell (or you sell none)", kind: "manual", required: true, where: "docs/LIFETIME_DEAL.md" },
  { id: "meta-business", group: "Legal and approvals", title: "Meta business verification approved", kind: "manual", required: true, where: "Admin -> Meta review" },
  { id: "meta-review", group: "Legal and approvals", title: "Meta App Review approved for the three permissions", kind: "manual", required: true, where: "Admin -> Meta review" },
  { id: "meta-live", group: "Legal and approvals", title: "Meta app switched from Development to Live", kind: "manual", required: true, where: "docs/META_APP_REVIEW.md, section 5" },
  // Running the business
  { id: "ops-paid-tiers", group: "Running the business", title: "Hosting and database plans upgraded where the free tier is not enough", kind: "manual", required: false, where: "docs/GO_LIVE_UPGRADE_CHECKLIST.md" },
  { id: "ops-backup", group: "Running the business", title: "Downloaded a settings backup and checked Supabase's own backups", kind: "manual", required: false, where: "Admin -> Backup" },
  { id: "ops-support", group: "Running the business", title: "Someone reads the support inbox every day", kind: "manual", required: false, where: "Admin -> Support" },
];

export const MANUAL_IDS: string[] = LAUNCH_ITEMS.filter((i) => i.kind === "manual").map((i) => i.id);
export const isManualId = (id: string): boolean => MANUAL_IDS.includes(id);

export type Evaluated = LaunchItem & { state: ItemState; detail: string; doneAt: string | null };

function auto(id: string, f: LaunchFacts): { state: ItemState; detail: string } {
  switch (id) {
    case "site-production":
      if (f.environment !== "production") return { state: "todo", detail: `This is a ${f.environment} environment. Check the live address instead.` };
      return f.appUrlIsHttps ? { state: "ok", detail: "Production, on https." } : { state: "todo", detail: "The app address is not https." };
    case "site-deploy-checks":
      if (f.deployProblems > 0) return { state: "todo", detail: `${f.deployProblems} problem${f.deployProblems === 1 ? "" : "s"} to fix.` };
      return f.deployWarnings > 0 ? { state: "warn", detail: `No problems, ${f.deployWarnings} warning${f.deployWarnings === 1 ? "" : "s"} to read.` } : { state: "ok", detail: "All clear." };
    case "site-migrations":
      return f.missingMigrations.length === 0 ? { state: "ok", detail: "Nothing is missing." } : { state: "todo", detail: `Not run yet: ${f.missingMigrations.join(", ")}.` };
    case "site-legal-details": {
      const missing = [!f.contactEmailSet && "support email", !f.operatorNameSet && "business name", !f.operatorCountrySet && "country"].filter(Boolean);
      return missing.length === 0 ? { state: "ok", detail: "All three are set." } : { state: "todo", detail: `Missing: ${missing.join(", ")}.` };
    }
    case "money-plans":
      return f.paidPlansWithPrice > 0 ? { state: "ok", detail: `${f.paidPlansWithPrice} paid plan${f.paidPlansWithPrice === 1 ? "" : "s"} priced.` } : { state: "todo", detail: "No paid plan has a monthly price yet." };
    case "money-bkash":
      return f.bkashReady ? { state: "ok", detail: "Saved and switched on." } : { state: "todo", detail: "Not saved or not switched on." };
    case "money-bkash-live":
      if (f.bkashMode === "live") return { state: "ok", detail: "Live mode." };
      return f.bkashMode === "sandbox" ? { state: "todo", detail: "Still in sandbox (test) mode." } : { state: "todo", detail: "No bKash mode saved yet." };
    case "email-sending":
      return f.emailSendingReady ? { state: "ok", detail: "Ready to send." } : { state: "todo", detail: "The Resend key or sender address is missing or invalid." };
    case "email-webhook":
      return f.emailWebhookReady ? { state: "ok", detail: "Ready." } : { state: "warn", detail: "Not set. Emails still send, but bounces are not tracked." };
    case "pub-facebook":
      if (f.socialMode === "mock") return { state: "todo", detail: "Test mode (pretend Facebook) is on." };
      if (f.socialMode === "off") return { state: "todo", detail: "META_APP_ID and META_APP_SECRET are missing." };
      return f.socialReady ? { state: "ok", detail: "Set up." } : { state: "todo", detail: "Some Facebook settings are still missing." };
    case "pub-live-flag":
      if (f.publishingBlockedByEnv) return { state: "todo", detail: "Publishing is blocked by a hosting setting." };
      return f.liveFlagOn ? { state: "ok", detail: "On." } : { state: "todo", detail: "Off. Turn it on in Admin -> Publishing when you are ready." };
    case "pub-scheduler":
      if (!f.cronSecretSet) return { state: "todo", detail: "CRON_SECRET is missing." };
      if (f.heartbeatAgeMinutes === null) return { state: "todo", detail: "The scheduler has never checked in." };
      return f.heartbeatAgeMinutes <= 10 ? { state: "ok", detail: `Last check-in ${Math.max(0, Math.round(f.heartbeatAgeMinutes))} minute(s) ago.` } : { state: "todo", detail: `Last check-in ${Math.round(f.heartbeatAgeMinutes)} minutes ago.` };
    case "seo-blog":
      return f.publishedBlogPosts >= 7 ? { state: "ok", detail: `${f.publishedBlogPosts} published.` } : { state: "warn", detail: `${f.publishedBlogPosts} published so far.` };
    default:
      return { state: "todo", detail: "Unknown item." };
  }
}

export function evaluate(facts: LaunchFacts, done: Record<string, string>): Evaluated[] {
  return LAUNCH_ITEMS.map((item) => {
    if (item.kind === "manual") {
      const at = done[item.id] ?? null;
      return { ...item, state: at ? "ok" : "todo", detail: at ? `Done on ${at.slice(0, 10)}.` : "Not done yet.", doneAt: at };
    }
    return { ...item, ...auto(item.id, facts), doneAt: null };
  });
}

export type LaunchSummary = { required: number; requiredDone: number; optional: number; optionalDone: number; ready: boolean; percent: number; blockers: string[] };

export function summarize(items: Evaluated[]): LaunchSummary {
  const required = items.filter((i) => i.required);
  const optional = items.filter((i) => !i.required);
  const requiredDone = required.filter((i) => i.state === "ok").length;
  return {
    required: required.length,
    requiredDone,
    optional: optional.length,
    optionalDone: optional.filter((i) => i.state === "ok").length,
    ready: requiredDone === required.length,
    percent: required.length === 0 ? 100 : Math.round((requiredDone / required.length) * 100),
    blockers: required.filter((i) => i.state !== "ok").map((i) => i.title),
  };
}

/** Keeps only known manual ids, with a valid date. Anything else in storage is dropped. */
export function cleanDone(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (value && typeof value === "object") {
    for (const [id, at] of Object.entries(value as Record<string, unknown>)) {
      if (isManualId(id) && typeof at === "string" && !Number.isNaN(new Date(at).getTime())) out[id] = at;
    }
  }
  return out;
}
