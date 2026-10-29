/**
 * Pure helpers for Admin -> Deployment. They read a plain settings object (never process.env directly),
 * report only whether something is set (never a value), and are tested without a network.
 * The length and format rules mirror the real readers: social/keys.ts, email/keys.ts, legal.ts, env.ts.
 */

export type EnvSource = Record<string, string | undefined>;
export type CheckState = "ok" | "warn" | "bad" | "off";
export type DeployCheck = { id: string; group: string; label: string; state: CheckState; detail: string };
export type DeployEnvironment = "production" | "preview" | "development";

const FROM_RE = /^(?:[^<>\r\n"]{1,80} <[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: string | undefined): string {
  return (value ?? "").trim();
}

export function deploymentEnvironment(source: EnvSource): DeployEnvironment {
  const env = text(source.VERCEL_ENV);
  if (env === "production" || env === "preview") return env;
  return "development";
}

function parseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function hostOf(value: string): string {
  return value.trim().toLowerCase().replace(/:\d+$/, "");
}

/** The public address the app uses, following the same order as resolveAppUrl in env.ts. */
export function effectiveAppUrl(source: EnvSource): string {
  const explicit = text(source.NEXT_PUBLIC_APP_URL);
  if (explicit) return explicit.replace(/\/+$/, "");
  const host = text(source.VERCEL_PROJECT_PRODUCTION_URL) || text(source.VERCEL_URL);
  return host ? `https://${host}` : "http://localhost:3000";
}

export function checkAppAddress(source: EnvSource, requestHost: string | null): DeployCheck[] {
  const env = deploymentEnvironment(source);
  const group = "Site address";
  const explicit = text(source.NEXT_PUBLIC_APP_URL);
  const checks: DeployCheck[] = [];

  if (!explicit) {
    checks.push({
      id: "app-url",
      group,
      label: "App address (NEXT_PUBLIC_APP_URL)",
      state: env === "production" ? "warn" : "off",
      detail:
        env === "production"
          ? "Not set. The site falls back to its Vercel address. Set it to your real address (for example https://your-domain.com) for Production, then redeploy."
          : "Not set. The site uses this deployment's own address, which is what you want for previews.",
    });
    return checks;
  }

  const url = parseUrl(explicit);
  if (!url) {
    checks.push({
      id: "app-url",
      group,
      label: "App address (NEXT_PUBLIC_APP_URL)",
      state: "bad",
      detail: "This is not a valid web address. It must start with https:// and contain no spaces.",
    });
    return checks;
  }

  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (env === "production" && isLocal) {
    checks.push({ id: "app-url", group, label: "App address (NEXT_PUBLIC_APP_URL)", state: "bad", detail: "Production points at localhost. Sign-in emails and Facebook would send people to the wrong place." });
  } else if (env === "production" && url.protocol !== "https:") {
    checks.push({ id: "app-url", group, label: "App address (NEXT_PUBLIC_APP_URL)", state: "bad", detail: "Production must use https://. Facebook and sign-in links require it." });
  } else if (url.pathname !== "/" || url.search || url.hash || explicit.endsWith("/")) {
    checks.push({ id: "app-url", group, label: "App address (NEXT_PUBLIC_APP_URL)", state: "warn", detail: "Use only the address itself, with no trailing slash or path (for example https://your-domain.com)." });
  } else if (env === "production" && url.hostname.endsWith(".vercel.app")) {
    checks.push({ id: "app-url", group, label: "App address (NEXT_PUBLIC_APP_URL)", state: "warn", detail: "Still the Vercel address. Fine for testing. Switch to your own domain at launch (docs/DEPLOYMENT_RUNBOOK.md)." });
  } else {
    checks.push({ id: "app-url", group, label: "App address (NEXT_PUBLIC_APP_URL)", state: "ok", detail: "Set." });
  }

  if (env === "preview") {
    checks.push({
      id: "app-url-preview",
      group,
      label: "Preview deployment",
      state: "warn",
      detail: "NEXT_PUBLIC_APP_URL is set for Preview too, so previews build links to that address. In Vercel, set it for Production only.",
    });
  }

  if (requestHost && env === "production") {
    const same = hostOf(requestHost) === url.hostname.toLowerCase();
    checks.push({
      id: "app-url-host",
      group,
      label: "This page's address matches the app address",
      state: same ? "ok" : "warn",
      detail: same
        ? "Yes."
        : `You opened this page on ${hostOf(requestHost)}, but the app address is ${url.hostname}. Sign-in links, Facebook, and emails use ${url.hostname}. Make one of them redirect to the other in Vercel -> Domains.`,
    });
  }
  return checks;
}

type Rule = { id: string; group: string; label: string; required: boolean; ok: boolean; missing: string; present?: string };

function fromRule(rule: Rule): DeployCheck {
  if (rule.ok) return { id: rule.id, group: rule.group, label: rule.label, state: "ok", detail: rule.present ?? "Set." };
  return { id: rule.id, group: rule.group, label: rule.label, state: rule.required ? "bad" : "off", detail: rule.missing };
}

export function checkSettings(source: EnvSource): DeployCheck[] {
  const env = deploymentEnvironment(source);
  const supabaseUrl = parseUrl(text(source.NEXT_PUBLIC_SUPABASE_URL));
  const aiKeyNames = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY"];
  const aiKeys = aiKeyNames.filter((name) => text(source[name]));

  const rules: Rule[] = [
    { id: "supabase-url", group: "Database", label: "Supabase address", required: true, ok: supabaseUrl !== null && text(source.NEXT_PUBLIC_SUPABASE_URL).length > 0, missing: "NEXT_PUBLIC_SUPABASE_URL is missing or not a web address (Supabase -> Project Settings -> API)." },
    { id: "supabase-anon", group: "Database", label: "Supabase public key", required: true, ok: text(source.NEXT_PUBLIC_SUPABASE_ANON_KEY).length >= 20, missing: "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or too short." },
    { id: "supabase-service", group: "Database", label: "Supabase service key (server only)", required: true, ok: text(source.SUPABASE_SERVICE_ROLE_KEY).length > 0, missing: "SUPABASE_SERVICE_ROLE_KEY is missing. Facebook connections, the scheduler, and account deletion need it." },
    { id: "ai-key", group: "AI writing", label: "At least one AI key", required: true, ok: aiKeys.length > 0, present: `${aiKeys.length} of 4 provider keys found (${aiKeys.join(", ")}).`, missing: "No provider key found. Add one of ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY." },
    { id: "meta-app", group: "Facebook", label: "Meta app (META_APP_ID and META_APP_SECRET)", required: true, ok: Boolean(text(source.META_APP_ID) && text(source.META_APP_SECRET)), missing: "Missing. See docs/META_SETUP.md." },
    { id: "token-key", group: "Facebook", label: "Page token encryption key", required: true, ok: text(source.TOKEN_ENCRYPTION_KEY).length >= 32, missing: "TOKEN_ENCRYPTION_KEY is missing or shorter than 32 characters. Keep a copy somewhere safe: losing it means reconnecting Pages." },
    { id: "cron-secret", group: "Scheduler", label: "Scheduler secret (CRON_SECRET)", required: true, ok: text(source.CRON_SECRET).length >= 16, missing: "CRON_SECRET is missing or shorter than 16 characters (docs/SCHEDULER_SETUP.md)." },
    { id: "resend-key", group: "Email", label: "Resend API key", required: true, ok: text(source.RESEND_API_KEY).length > 0, missing: "RESEND_API_KEY is missing (docs/EMAIL_SETUP.md)." },
    { id: "resend-from", group: "Email", label: "Sender address", required: true, ok: FROM_RE.test(text(source.RESEND_FROM_EMAIL)), missing: text(source.RESEND_FROM_EMAIL) ? "RESEND_FROM_EMAIL is not in a valid form. Use: LazyAI <notifications@your-domain.com>." : "RESEND_FROM_EMAIL is missing." },
    { id: "resend-webhook", group: "Email", label: "Resend webhook secret", required: false, ok: text(source.RESEND_WEBHOOK_SECRET).length > 0, missing: "Not set. Without it, bounces and spam complaints are not tracked." },
    { id: "legal-name", group: "Legal pages", label: "Operator name", required: false, ok: text(source.NEXT_PUBLIC_OPERATOR_NAME).length > 0, missing: "NEXT_PUBLIC_OPERATOR_NAME is not set; the pages say \"LazyAI\"." },
    { id: "legal-email", group: "Legal pages", label: "Contact email", required: true, ok: EMAIL_RE.test(text(source.NEXT_PUBLIC_CONTACT_EMAIL)), missing: "NEXT_PUBLIC_CONTACT_EMAIL is missing or invalid. Meta and the privacy pages need a real contact." },
    { id: "legal-country", group: "Legal pages", label: "Governing country", required: true, ok: text(source.NEXT_PUBLIC_OPERATOR_COUNTRY).length > 0, missing: "NEXT_PUBLIC_OPERATOR_COUNTRY is not set (the Terms name it)." },
    { id: "image-provider", group: "Optional", label: "Stock photo search", required: false, ok: text(source.IMAGE_PROVIDER_API_KEY).length > 0 || text(source.PEXELS_API_KEY).length > 0 || text(source.PIXABAY_API_KEY).length > 0 || text(source.UNSPLASH_ACCESS_KEY).length > 0, present: "A key was found in the environment.", missing: "No environment key. You can add Pixabay or Unsplash keys in Admin, Stock photos. Uploading your own images works without it." },
  ];

  const checks = rules.map(fromRule).map((check) => {
    // A missing required setting is only an emergency in production; elsewhere it is a reminder.
    if (check.state === "bad" && env !== "production") return { ...check, state: "warn" as const };
    return check;
  });

  if (text(source.AI_MOCK) === "1") {
    checks.push({ id: "ai-mock", group: "AI writing", label: "Test mode for AI (AI_MOCK)", state: env === "production" ? "warn" : "off", detail: env === "production" ? "AI_MOCK=1 is set but is ignored in production. Remove it." : "On: sample text is used instead of a real AI." });
  }
  if (text(source.META_MOCK) === "1") {
    checks.push({ id: "meta-mock", group: "Facebook", label: "Test mode for Facebook (META_MOCK)", state: env === "production" ? "warn" : "off", detail: env === "production" ? "META_MOCK=1 is set but is ignored in production. Remove it." : "On: pretend Pages are used instead of real Facebook." });
  }
  if (text(source.LIVE_PUBLISHING_ENABLED) === "0") {
    checks.push({ id: "live-block", group: "Scheduler", label: "Emergency stop (LIVE_PUBLISHING_ENABLED=0)", state: "warn", detail: "Real Facebook posting is forced OFF by this setting. Remove it to let the Admin switch decide." });
  }
  return checks;
}

export type Address = { label: string; value: string; where: string };

/** Public addresses the owner must copy into other dashboards. None of them is a secret. */
export function registrationAddresses(source: EnvSource): Address[] {
  const base = effectiveAppUrl(source);
  const host = parseUrl(base)?.hostname ?? "";
  const redirect = text(source.META_REDIRECT_URI) || `${base}/api/meta/callback`;
  return [
    { label: "Supabase Site URL", value: base, where: "Supabase -> Authentication -> URL Configuration" },
    { label: "Supabase redirect URL", value: `${base}/**`, where: "Supabase -> Authentication -> URL Configuration -> Redirect URLs" },
    { label: "Meta valid OAuth redirect URI", value: redirect, where: "Meta app -> Facebook Login -> Settings" },
    { label: "Meta deauthorize callback", value: `${base}/api/meta/deauthorize`, where: "Meta app -> Facebook Login -> Settings" },
    { label: "Meta data deletion request URL", value: `${base}/api/meta/data-deletion`, where: "Meta app -> App settings -> Basic" },
    { label: "Meta privacy policy URL", value: `${base}/privacy`, where: "Meta app -> App settings -> Basic" },
    { label: "Meta terms of service URL", value: `${base}/terms`, where: "Meta app -> App settings -> Basic" },
    { label: "Meta app domain", value: host, where: "Meta app -> App settings -> Basic" },
    { label: "Resend webhook endpoint", value: `${base}/api/email/webhook`, where: "Resend -> Webhooks" },
    { label: "Scheduler address", value: `${base}/api/cron/dispatch`, where: "Supabase SQL cron job (docs/SCHEDULER_SETUP.md)" },
  ];
}

/** Pages to open by hand after every production deploy. */
export const SMOKE_PAGES: { href: string; expect: string }[] = [
  { href: "/", expect: "Home page loads with the logo" },
  { href: "/api/health", expect: "Shows ok" },
  { href: "/pricing", expect: "Pricing loads" },
  { href: "/privacy", expect: "Privacy Policy loads" },
  { href: "/terms", expect: "Terms load" },
  { href: "/data-deletion", expect: "Data deletion page loads" },
  { href: "/robots.txt", expect: "Lists the sitemap at your real address" },
  { href: "/sitemap.xml", expect: "Addresses use your real domain" },
  { href: "/auth/login", expect: "Sign-in page loads" },
];

/** Tables that browser sessions can read, one per migration, used to detect migrations that were never run. */
export const MIGRATION_PROBES: { migration: string; table: string }[] = [
  { migration: "0002", table: "content_items" },
  { migration: "0003", table: "ai_provider_settings" },
  { migration: "0004", table: "source_documents" },
  { migration: "0005", table: "campaign_slots" },
  { migration: "0011", table: "platform_settings" },
  { migration: "0012", table: "email_events" },
  { migration: "0013", table: "plans" },
];

export type ProbeResult = "present" | "missing" | "unknown";

/** Maps the error of a "read zero rows" request to whether the table exists. */
export function interpretProbe(error: { code?: string } | null): ProbeResult {
  if (!error) return "present";
  const code = error.code ?? "";
  if (code === "42501") return "present"; // exists, but this role may not read it
  if (code === "42P01" || code === "PGRST205") return "missing";
  return "unknown";
}
