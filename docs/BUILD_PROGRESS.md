# LazyAI — Build Progress

Source of truth for build status. Updated at the end of every batch.
Plan: [`LAZYAI_MASTER_PLAN.md`](./LAZYAI_MASTER_PLAN.md) (see section 23 for owner constraints)

## Summary

| Batch | Title | Status |
|---|---|---|
| 0 | Repository inspection and plan | DONE |
| 1 | App foundation | DONE (owner deployed and verified) |
| 2 | Supabase and authentication | DONE (owner-verified, see below) |
| 3 | Data model and dashboard | DONE (owner reports deployed and SQL run successfully) |
| 4 | AI adapter and single-post generation | DONE per owner report (deployed, SQL run successfully); real AI quality not yet reported |
| 5 | URL extraction | DONE per owner report (deployed, SQL run successfully); real-page results not yet reported |
| 6 | Campaign planner and bulk generation | DONE for SQL (owner reports `ALL CAMPAIGN PLANNER TESTS PASSED`); GitHub Actions result and browser trial of the progress panel not yet reported |
| 7 | Media and images | DONE per owner report (migration 0006 and SQL test run; owner confirmed steps done). Thumbnails added in Batch 8 |
| 8 | Meta OAuth and Facebook Pages | DONE per owner report (migrations 0007/0008 run, Meta app created, steps done); real connection result not yet reported in detail |
| 9 | Durable scheduler and publishing | DONE per owner report (deployed). Owner reported posts not publishing: fixed in a follow-up (Admin switch, diagnostics, time zone clarity; migration 0011) |
| 10 | Resend and email | DONE per owner report |
| 11 | Usage limits and hardening (+ account deletion/export) | DONE per owner report (deployed to Production). Migration 0013 and its SQL tests: owner to confirm (Admin -> Deployment shows the migration row) |
| 12 | Deployment and DNS runbook | DONE per owner report (uploaded, Vercel green). Dependabot major upgrades disabled |
| 13 | Release readiness | **Code and docs written, owner verification pending** (accessibility fixes, /help, release tests, checklist) |

---

## Batch 13 — Release readiness

**Status:** CODE AND DOCS WRITTEN, owner verification pending. Launch is NOT approved. No live posting, DNS, or paid change was made.

### Follow-up from Batch 12
Batch 12's `deployment-checks.ts` names several keys, which the older `security.test.ts` (allowlist of files that may mention them) would reject. Fixed in Batch 12 follow-up inside this batch: the test now lists that file explicitly and a new test proves it never reads the environment itself. Owner: check the GitHub Actions tab (Vercel does not run tests).
Owner reported: 0013 migration done; Batch 12 deployed; Deployment page rows green.

### What was built
- Accessibility: skip link and `id="main-content"` on every page; low-contrast gray text (`text-ink-300/400`) moved to `text-ink-500`; reduced-motion rule covers animations and transitions.
- Customer safety: operator-only setup hints (Vercel, Meta app, repo file names) now show only to platform admins; customers get plain wording. The `social_not_configured` message no longer mentions a repo file.
- Public `/help` page (English), linked in the footer and sitemap.
- `src/lib/release-readiness.test.ts`: status labels match the database enums, every service error and publishing failure code has plain words, alt text, skip link, zoom, contrast, new-tab link safety, reduced motion, smoke pages exist.
- Docs: `RELEASE_CHECKLIST.md` (automated checks, 30-minute walk-through, test-Page publishing flow, launch approval wording), `KNOWN_LIMITATIONS.md`, `INCIDENTS.md`, ADR 0009.

### Files changed
New: `src/components/ui/skip-link.tsx`, `src/app/(marketing)/help/page.tsx`, `src/lib/release-readiness.test.ts`, `docs/RELEASE_CHECKLIST.md`, `docs/KNOWN_LIMITATIONS.md`, `docs/INCIDENTS.md`, `docs/decisions/0009-release-readiness.md`.
Changed: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/sitemap.ts`, `src/lib/site.ts`, `src/lib/service-messages.ts`, `src/lib/services/social.ts`, `src/lib/security.test.ts`, `src/app/app/pages/page.tsx`, `src/app/admin/deployment/page.tsx` (icon contrast), main-landmark ids in the marketing, auth, app, admin, onboarding and not-found layouts/pages, gray-text fixes in about 14 component and page files, `docs/BUILD_PROGRESS.md`, `docs/NEW_SESSION_START.md`. Deleted: none. No database migration.

### Tests / checks and results
| Check | Result |
|---|---|
| New release-readiness tests (11), stand-in runner under tsx | PASS |
| security, copy-rules, secret-scan, site tests, stand-in runner | PASS |
| Lint, typecheck, full test suite, build | **NOT RUN** here (no network or `node_modules`); GitHub Actions and Vercel are the real check |
| Real browser end-to-end tests, real screen reader, real phones | NOT DONE (manual checklist in RELEASE_CHECKLIST.md) |

### Owner steps
1. Upload the Batch 13 files; confirm GitHub Actions (all steps) and the Vercel build are green.
2. Close the major Dependabot pull requests (tailwindcss, typescript, tailwind-merge, zod) without merging.
3. Do the walk-through in `docs/RELEASE_CHECKLIST.md` sections 2 and 4. Section 3 (real posting on a test Page) only when you decide to.
4. Read `docs/KNOWN_LIMITATIONS.md`.

### Decisions
Accessibility and message quality are guarded by tests (ADR 0009). Launch needs the owner's written approval (RELEASE_CHECKLIST.md section 6).

### Known issues / risks
Meta App Review, a verified Resend domain, a lawyer's review of the legal pages, and paid plans are outside approvals still to do. Major package upgrades are postponed.

### Exact next action
Owner verifies and reports Actions/Vercel results and the walk-through findings. Then fix what they found. Launch only after written approval.

---

## Batch 12 — Deployment and DNS runbook

**Status:** DONE per owner report. No DNS, domain, or live setting was changed.

### Vercel results reviewed first (Batch 11 follow-up)
- Batch 11 (`c403445`) and the later GitHub upload (`985eea5`) are both **Ready** in Production. The live site is fine.
- The 9 other deploys are Dependabot **Preview** builds from `dependabot/...` branches, created because Batch 11 added `.github/dependabot.yml`. Two failed: `tailwindcss 3.4.19 -> 4.3.3` (Tailwind 4 drops `tailwind.config.ts` style setup, the `tailwindcss` PostCSS plugin, and `@tailwind` directives, all used here) and `typescript 5.9.3 -> 7.0.2` (new compiler major version). Neither touches `main`, so **no application code fix was needed**.
- Related only through configuration: the Batch 11 Dependabot file allowed major upgrades. Fixed by ignoring semver-major npm updates (ADR 0008). `tailwind-merge 2 -> 3` and `zod 3 -> 4` went green on Vercel but must **not** be merged now (tailwind-merge 3 only supports Tailwind 4; Zod 4 changes error and email/url APIs; Vercel does not run the tests).

### What was built
- `.github/dependabot.yml`: no automatic major npm upgrades; minor and patch stay grouped.
- Admin -> Deployment (`/admin/deployment`): environment, app address checks (https, no path, matches the opened host in production, preview warning), presence checks for every setting (never values; red only in production), one-table-per-migration database probe, copy-ready addresses for Supabase, Meta, Resend and the scheduler, and a smoke-test page list.
- `src/lib/deployment-checks.ts` (+ test): pure logic, mirrors the real key rules.
- Docs: `docs/DEPLOYMENT_RUNBOOK.md` (environments, domain, DNS, Resend DNS, DMARC, rollback, Dependabot handling), `docs/GO_LIVE_UPGRADE_CHECKLIST.md`, ADR 0008. `docs/SECURITY.md` links to the runbook.

### Files changed
New: `src/lib/deployment-checks.ts`, `src/lib/deployment-checks.test.ts`, `src/app/admin/deployment/page.tsx`, `docs/DEPLOYMENT_RUNBOOK.md`, `docs/GO_LIVE_UPGRADE_CHECKLIST.md`, `docs/decisions/0008-deployment-and-dependency-policy.md`.
Changed: `.github/dependabot.yml`, `src/components/admin/admin-nav.tsx`, `docs/BUILD_PROGRESS.md`, `docs/NEW_SESSION_START.md`, `docs/SECURITY.md`. Deleted: none. No database migration.

### Tests / checks and results
| Check | Result |
|---|---|
| New unit tests (10), run under a stand-in runner with tsx | PASS |
| Batch 12 files vs copy rules (no Bengali, no British spellings) and secret-pattern scan | PASS |
| `npm run lint` / typecheck / full test suite / build | **NOT RUN** (no network, no `node_modules`); owner's GitHub Actions and Vercel build are the real check |

### Owner steps
1. Upload the Batch 12 files, confirm GitHub Actions and the Vercel build are green.
2. Close the failed or major Dependabot pull requests without merging (tailwindcss, typescript, tailwind-merge, zod). For the minor-and-patch group and the two `actions/*` pull requests, merge only if the GitHub Actions checks on that pull request are green.
3. Confirm Batch 11 migration `0013` and its SQL tests were run (Admin -> Deployment shows a "Database setup" row for it).
4. Open Admin -> Deployment and read every row.

### Decisions
- No automatic major upgrades; planned by hand after launch.
- Production environment variable `NEXT_PUBLIC_APP_URL` set for Production only.
- Domain, DNS, and paid upgrades are documented but **not performed** (approval required).

### Known issues / risks
- The migration probe relies on the error code the API returns for a missing table; if Supabase changes it, a row shows "Could not be checked" rather than a false "missing".
- Files 0006 to 0010 are not probed (functions or tables browsers cannot read); their SQL tests cover them.

### Exact next action
Owner verifies the steps above and reports the Deployment page rows that are not green. Then **Batch 13 — Release readiness** (accessibility, performance, App Review preparation, final security review).

---

## Batch 11 — Usage limits, hardening, account deletion and export

**Status:** IN PROGRESS (code written; migration 0013 not applied; lint / typecheck / vitest / build not run in the sandbox; no database run).

### What was built
- **Plans and limits enforced in the database** (migration 0013): `plans` (Free, Standard), per-workspace plan and overrides, limits for AI posts per month, posts, connected Pages, images, image storage, open campaigns. Triggers and functions refuse over-limit writes, including direct API calls. Services show plain messages; a campaign that reaches a limit pauses. Settings shows **Plan and usage** with bars. Admin -> **Plans** changes a workspace's plan.
- **Rate limiting** (`rate_limit_hit`): image uploads (30/h), thumbnail runs (20/h), Facebook checks (30/h), data export (5/day), account deletion attempts (5/h).
- **Account export** (`/api/account/export`, Settings -> Download my data): JSON of the person's own data via an allow-list; secrets, tokens, image files, and storage paths never included.
- **Account deletion** (Settings -> Delete my account): password again + typed DELETE, blocked while other members exist, image files removed, then the sign-in account is deleted and database cascades remove the workspace and everything in it. Database side proven by `rls_account_deletion.sql`.
- **Logging hygiene:** `src/lib/log.ts` + `src/lib/redact.ts` (key-name and value-shape redaction), audit metadata redacted, project-wide secret scan test, `.env.example` must stay value-free.
- **Hardening:** HSTS, COOP, X-Permitted-Cross-Domain-Policies, and a safe CSP subset; Dependabot weekly; weekly `npm audit` summary workflow (never blocks deploys). `docs/SECURITY.md` covers special limits, key rotation, and incident steps. Data Deletion and Privacy pages now mention self-service deletion and download.

### Files
New: `supabase/migrations/0013_plans_and_limits.sql`, `supabase/tests/{rls_plans_limits,rls_account_deletion}.sql`, `docs/{SECURITY.md,decisions/0007-limits-and-hardening.md}`, `.github/{dependabot.yml,workflows/security.yml}`, `src/lib/{plans,redact,log,account-export,secret-scan.test}.ts` (+ tests), `src/lib/data/{plans,export,account}.ts`, `src/lib/services/{plans,account}.ts`, `src/app/api/account/export/route.ts`, `src/app/app/account-actions.ts`, `src/app/admin/plans/{page.tsx,actions.ts}`, `src/components/app/{plan-usage-card,delete-account-form}.tsx`.
Changed: `next.config.ts`, `src/lib/{security.test.ts,service-messages.ts,campaign-batch.ts,campaign-failure.ts}` (+ test), `src/lib/services/{errors,generation,content,campaigns,social,media,audit}.ts`, `src/app/app/settings/page.tsx`, `src/components/admin/admin-nav.tsx`, `src/app/api/{cron/dispatch,email/webhook}/route.ts`, privacy and data-deletion pages, `docs/*`.
Deleted: none.

### Tests / checks and results
| Check | Result |
|---|---|
| Pure-logic tests (plan arithmetic, redaction of keys/tokens/JWTs, export allow-list, plan-limit handling in campaigns, secret scan of the whole project, security headers) plus all earlier tests, with a stand-in runner under `tsx` | 315 passed, 0 failed |
| Real `vitest`, `lint`, full `typecheck`, `next build` | **NOT RUN** (no network) |
| Partial typecheck | Only errors caused by missing React/Next packages remained |
| No Bengali text in source | PASS (scanned) |
| SQL 0013 and its two tests | **NOT RUN** (no database) |

### Risks / things to watch
- Existing workspaces start on Free; an already-above-limit workspace is not trimmed, it just cannot add more.
- `delete auth user` relies on `workspaces.owner_id ... on delete cascade` and on every tenant table cascading from the workspace; the SQL test checks this for the main tables.
- A full script-blocking CSP is deferred on purpose.
- Account deletion needs the Supabase service key (already required for Facebook features).

### Exact next action
Owner uploads the Batch 11 zip, confirms CI, runs 0013 and its two tests, checks Settings (Plan and usage, Download my data), and reads docs/SECURITY.md. Next batch: 12 (deployment and DNS runbook), then 13 (release readiness).

---

## Batch 9 follow-up and Batch 10 — Publishing diagnostics, then email

**Status:** IN PROGRESS (code written; migrations 0011 and 0012 not applied; lint / typecheck / vitest / build not run in the sandbox; no real email sent).

### Follow-up: "scheduled posts do not publish"
Owner report: posts scheduled but not published; the banner said an admin must turn publishing on, but there was no place to do it; confusion about server time versus computer time. Causes and fixes:
- The only switch was an environment variable (`LIVE_PUBLISHING_ENABLED=1`) that was not documented in the screen. **Fix:** a real switch in **Admin -> Publishing** (migration 0011, `platform_settings`, platform admins only, with a confirmation box). The environment variable is now only an emergency stop (`=0`).
- No way to see whether the scheduler runs. **Fix:** every scheduler run leaves a heartbeat. Admin -> Publishing shows green/yellow/red checks (Facebook settings, `CRON_SECRET`, scheduler last seen, switch state), the queue counts (due now, waiting, failed, published in 24 h), and a **Publish due posts now** button that runs the publisher by hand without the scheduler.
- Overdue posts gave no hint. **Fix:** the post page says "This post is overdue" and why, and links platform admins to Admin -> Publishing.
- Time zones: the schedule box now shows the current time in the workspace time zone, what the chosen time means on the person's computer, a warning (with a link to Settings) when the computer's time zone differs from the workspace's, and a message when the time has already passed. The server time zone (UTC) never matters: schedules are converted with the workspace time zone. Shared helpers moved to `src/lib/zone-time.ts`.

### Batch 10: email (Resend)
- Notices: welcome (once, after onboarding), campaign finished, post not published (retries exhausted, permanent failure, or unclear result), Facebook Page needs attention. Sent after the response; failures never break the product. Duplicates impossible (unique key + Resend idempotency key).
- Settings -> Email notifications (three choices; bounces and complaints pause an address). Admin -> Email (setup checks, test email to yourself, delivery log without addresses or text).
- Signed delivery webhook `/api/email/webhook` (Svix signature, 5-minute replay window, checked against an independent Python vector).
- `docs/EMAIL_SETUP.md` (Resend domain, DNS records to copy, API key, Vercel settings, webhook, Supabase SMTP for sign-in emails) and ADR 0006.

### Files
New: `supabase/migrations/{0011_platform_settings,0012_email}.sql`, `supabase/tests/{rls_platform_settings,rls_email}.sql`, `docs/{EMAIL_SETUP.md,decisions/0006-email.md}`, `src/lib/zone-time.ts`, `src/lib/data/{platform,email}.ts`, `src/lib/email/{provider,templates,keys}.ts` (+ test), `src/lib/services/email.ts`, `src/components/schedule/when-field.tsx`, `src/components/admin/{run-publisher-form,send-test-email-form}.tsx`, `src/components/app/email-preferences-form.tsx`, `src/app/admin/publishing/{page.tsx,actions.ts}`, `src/app/admin/email/{page.tsx,actions.ts}`, `src/app/api/email/webhook/route.ts`.
Changed: `src/lib/campaign-plan.ts` (time helpers moved), `src/lib/social/keys.ts`, `src/lib/services/{publisher,scheduling,campaigns}.ts`, `src/lib/data/{publisher,types}.ts`, `src/components/schedule/schedule-card.tsx`, `src/components/admin/admin-nav.tsx`, `src/app/app/actions.ts`, `src/app/app/settings/page.tsx`, `src/app/app/content/[itemId]/page.tsx`, `src/lib/security.test.ts`, `.env.example`, `docs/*`.
Deleted: none.

### Tests / checks and results
| Check | Result |
|---|---|
| Pure-logic tests (email sender and error mapping without leaking the key, Svix webhook verification with an independent vector and replay protection, delivery event mapping, templates incl. HTML escaping and header-injection safety) plus all earlier tests, with a small stand-in runner under `tsx` | 292 passed, 0 failed |
| Real `vitest`, `lint`, full `typecheck`, `next build` | **NOT RUN** (no network) |
| Partial typecheck | Only errors caused by missing React/Next packages remained |
| No Bengali text in source | PASS (scanned) |
| SQL 0011/0012 and tests | **NOT RUN** (no database) |
| Real email delivery, real Resend webhook | **NOT RUN** |

### Risks / things to watch
- `after()` (Next.js 15) runs email work after the response; if it is unavailable in some context the code falls back to running it immediately.
- The Resend account, domain, DNS records, and webhook must be set up by the owner; until then notifications are skipped and logged.
- Supabase's own sign-in emails are separate: point them at Resend SMTP (dashboard setting) or they stay on Supabase's limited default sender.

### Exact next action
Owner uploads the zip, confirms CI, runs 0011 + 0012 and their tests, opens **Admin -> Publishing** to switch live publishing on (when approved) and to read the checks, then sets up Resend by `docs/EMAIL_SETUP.md`. Next batch: 11 (usage limits and hardening, account deletion/export).

---

## Batch 9 — Legal pages, data deletion callback, scheduler and publishing

**Status:** IN PROGRESS (code written; migrations 0009 and 0010 not applied; lint / typecheck / vitest / build not run in the sandbox; no real Facebook call, no database run, no real scheduler call). **Real Facebook posting is OFF by default** (switch in Admin -> Publishing; migration 0011); the owner has approved connection work only, so publishing stays gated until the owner switches it on.

### What was built
**Mandatory pages (for the Meta submission):** Privacy Policy (`/privacy`), Terms of Service (`/terms`), Acceptable Use Policy (`/acceptable-use`), Cookie Notice (`/cookies`), Data Deletion (`/data-deletion`, with a status checker), and Contact (`/contact`), all in American English and written for how LazyAI really works (AI providers, Facebook permissions, token storage, retention, rights). The operator name, contact email, and governing country come from public Vercel settings (`NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_OPERATOR_COUNTRY`), not hard-coded. Footer, sitemap, and sign-up consent text link to them.
**Meta callbacks:** `POST /api/meta/data-deletion` (returns confirmation code and status URL) and `POST /api/meta/deauthorize`, both verifying Meta's `signed_request` HMAC with the app secret (checked against an independent Python test vector). They disconnect the person's Pages, delete stored tokens, cancel pending posts, and clear the stored Facebook name and permissions. Migration 0009 stores only a code, source, and status (no personal data, no browser access).
**Scheduling:** schedule an approved post to a connected Page (date and time in the workspace timezone), change the time, cancel, retry, and resolve uncertain results, all on the post page; the calendar shows failures and links to posts. Rules are enforced in the database (migration 0010): approved posts only, connected Pages where the person can post, no past times, one live entry per post and Page.
**Publishing queue:** `/api/cron/dispatch` (needs `Authorization: Bearer <CRON_SECRET>`, fails closed) claims due posts atomically, publishes text or photo posts through the Meta adapter, retries only clear refusals (rate limit) with growing delays, never retries uncertain results automatically, fails permanent problems at once, flags Page problems on the Pages screen, skips posts more than 6 hours late, re-checks approval and Page status at publish time, and hands unused posts back when time runs out. Disconnecting a Page cancels its pending posts.
**Triggering:** Supabase `pg_cron` + `pg_net` every minute (`docs/SCHEDULER_SETUP.md`); `vercel.json` adds a once-a-day safety net (Hobby limit).

### Files
New: `supabase/migrations/{0009_data_deletion,0010_scheduling}.sql`, `supabase/tests/{rls_data_deletion,rls_scheduling}.sql`, `docs/{SCHEDULER_SETUP,META_APP_REVIEW}.md`, `docs/decisions/0005-scheduling-and-publishing.md`, `vercel.json`, `src/lib/{legal,publish-dispatch,schedule-text}.ts`, `src/lib/social/signed-request.ts`, `src/lib/data/{scheduling,publisher}.ts`, `src/lib/services/{scheduling,publisher,data-deletion}.ts`, `src/app/api/cron/dispatch/route.ts`, `src/app/api/meta/{data-deletion,deauthorize}/route.ts`, `src/app/app/schedule/actions.ts`, `src/components/{marketing/legal-page,schedule/schedule-card}.tsx`, pages `acceptable-use`, `cookies`, `data-deletion` (+ `status`) under `src/app/(marketing)`, and tests.
Changed: `privacy`, `terms`, `contact` pages (placeholders replaced), `src/app/(marketing)/...`, `src/lib/{site.ts,security.test.ts,service-messages.ts}`, `src/app/sitemap.ts`, `src/components/auth/auth-forms.tsx`, `src/lib/social/{keys,provider,meta-provider}.ts` (+ tests), `src/lib/data/{social,types,overview}.ts`, `src/lib/services/{errors,social}.ts`, `src/app/app/content/[itemId]/page.tsx`, `src/app/app/calendar/page.tsx`, `.env.example`, `docs/*`.
Deleted: none.

### Tests / checks and results
| Check | Result |
|---|---|
| Pure-logic tests (dispatch rules and duplicate protection with fakes, backoff, message composition, cron secret check, `signed_request` vector, schedule text and time formatting, uncertain-result flags in the Meta adapter) plus all earlier tests, with a small stand-in runner under `tsx` | 276 passed, 0 failed |
| Real `vitest`, `lint`, full `typecheck`, `next build` | **NOT RUN** (no network) |
| Partial typecheck | Only errors caused by missing React/Next packages remained |
| No Bengali text in source | PASS (scanned) |
| SQL 0009/0010 and tests (including concurrent-claim, uncertain, missed-window, retry limits) | **NOT RUN** (no database) |
| Real scheduler, real Facebook posting | **NOT RUN** (and posting is gated) |

### Risks / things to watch
- The SQL tests use `set local role service_role`; if the SQL Editor refuses that, the message will say so and the test needs adjusting (not the functions).
- Legal text is written for LazyAI's real data flows but is not legal advice; the owner should have it reviewed, and must confirm the 30-day deletion commitment and set the contact email, operator name, and country.
- Timing precision is about one minute; the first real publish has never run. Test with a throw-away Page first.
- `vercel.json` has a daily cron: on Hobby, never change it to a faster schedule (deployment would fail).
- Older posts that were scheduled before Batch 9 cannot exist (the table was empty), so no migration of data is needed.

### Exact next action
Owner uploads the Batch 9 zip, confirms CI, runs 0009 + its test and 0010 + its test, sets the public legal variables and `CRON_SECRET` in Vercel, checks the legal pages signed out, sets up the scheduler (`docs/SCHEDULER_SETUP.md`), and fills Meta's forms (`docs/META_APP_REVIEW.md`). Then, only when the owner approves real posting, set `LIVE_PUBLISHING_ENABLED=1` and test with one scheduled post on a test Page. Next batch: 10 (Resend and email), then 11 (usage limits, account deletion/export, hardening).

---

## Batch 8 — Meta OAuth and Facebook Pages (plus media thumbnails)

**Status:** IN PROGRESS (code written; migrations 0007 and 0008 not applied; lint / typecheck / vitest / build not run in the sandbox; no real Facebook call and no database run).

### What was built
**Thumbnails (owner request):** every upload and stock import now also stores a small WebP preview (at most 480 px, camera rotation applied, no GPS/metadata) made with `sharp`. The library shows compact square thumbnails (2 to 8 per row), click opens the full image in a new tab; post image card uses the thumbnail. A "Create thumbnails" button fills in older images (8 per click). Migration 0007 adds `media_assets.thumb_path`, a second `register_media_asset(... p_thumb_path)` form, and `set_media_thumbnail()`.

**Facebook Pages connection (live connection approved by the owner; no publishing):**
- `SocialPublishingProvider` interface, **Meta adapter** (login URL for classic permissions or Facebook Login for Business `config_id`, code exchange, long-lived token, `debug_token`, `/me/accounts` with paging, Page check, publish text/link/photo, `appsecret_proof`, error classification) and a **mock provider** (`META_MOCK=1`, never in production).
- **Connect flow:** "Connect Facebook" (admin/owner) -> Facebook -> `/api/meta/callback` -> choose Pages -> saved. State is checked three ways (URL, HttpOnly cookie, stored hash) plus user and workspace; attempts are one-time and expire after 10 minutes.
- **Token safety:** Page tokens are encrypted (AES-256-GCM, bound to workspace and Page) in `social_page_tokens`; that table and `social_oauth_flows` have no browser access (service role only); no token column exists on browser-readable tables. Tokens never appear in logs, errors, or UI.
- **Pages screen** (`/app/pages`): status, last check, **Check connection**, **Reconnect**, **Disconnect**, setup-needed box that lists missing settings by name and the redirect address to register, test-mode banner.
- **Errors** are plain English and actionable (expired, missing permission, lost Page role, busy, denied, no Pages).
- `docs/META_SETUP.md` is the step-by-step Meta app guide; ADR 0004 records the decisions.

### Files
New: `supabase/migrations/{0007_media_thumbnails,0008_facebook_connections}.sql`, `supabase/tests/{rls_media_thumbnails,rls_social}.sql`, `docs/{META_SETUP.md,decisions/0004-facebook-connection.md}`, `src/lib/media/thumbnail.ts` (+test), `src/lib/crypto/token-crypto.ts` (+test), `src/lib/social/{provider,meta-provider,mock-provider,flow,keys}.ts` (+tests), `src/lib/data/social.ts`, `src/lib/services/social.ts`, `src/app/app/pages/{page.tsx,actions.ts,connect/page.tsx}`, `src/app/api/meta/callback/route.ts`.
Changed: `package.json` (adds `sharp`), `.env.example`, `src/middleware.ts` (session refresh for `/api/meta`), `src/lib/security.test.ts`, `src/lib/services/{errors,media}.ts`, `src/lib/service-messages.ts`, `src/lib/data/media.ts`, `src/lib/supabase/admin.ts`, `src/app/app/media/{page.tsx,actions.ts}`, `src/components/media/{media-grid,post-image-card}.tsx`, `docs/{BUILD_PROGRESS,NEW_SESSION_START,SUPABASE_SETUP}.md`.
Deleted: none.

### Tests / checks and results
| Check | Result |
|---|---|
| Pure-logic tests (thumbnails with real `sharp` 0.34.5 images, token encryption, OAuth state, Meta adapter and mock with a fake network, error classification, HMAC checked against openssl/Python) plus all earlier tests, with a small stand-in runner under `tsx` | 249 passed, 0 failed |
| Real `vitest`, `lint`, full `typecheck`, `next build` | **NOT RUN** (no network; `sharp` is a new dependency to be installed by CI) |
| Partial typecheck | Only errors caused by missing React/Next packages remained |
| No Bengali text in source | PASS (scanned) |
| SQL 0007/0008 and their tests | **NOT RUN** (no database) |
| Real Facebook login, real token exchange, real browser use | **NOT RUN**. The Meta adapter follows Meta's documentation but has never talked to Meta |

### Risks / things to watch
- First contact with real Meta: URL parameters for Facebook Login for Business (`config_id`, `override_default_response_type`) follow the documentation; if Facebook rejects the login URL, send the exact message.
- `debug_token` scopes are only enforced when Facebook returns them; a missing permission otherwise shows up on "Check connection" or at publish time.
- Needs `SUPABASE_SERVICE_ROLE_KEY` and `TOKEN_ENCRYPTION_KEY` in Vercel. Losing the encryption key means reconnecting Pages.
- `sharp` must install on CI/Vercel (normal for Next.js; prebuilt binaries).
- Customer-facing use needs Meta App Review and business verification (`docs/META_SETUP.md`).

### Exact next action
Owner uploads the Batch 8 zip, confirms CI, runs 0007 + `rls_media_thumbnails.sql` and 0008 + `rls_social.sql`, presses **Create thumbnails** in Media, creates the Meta app by `docs/META_SETUP.md`, adds the Vercel settings, redeploys, and connects one own Page. Then Batch 9 (durable scheduler and publishing) - live posting needs the owner's separate approval.

---

## Batch 7 — Media and images

**Status:** IN PROGRESS (code written; migration 0006 not applied; lint / typecheck / vitest / build not run in the sandbox; no real upload, no real stock search, no database run).

### What was built
- **Media library** (`/app/media`): upload JPG, PNG, WebP, or GIF (up to 4 MB, 8,000 px), alt text and credit, edit details, delete, usage counter (100 files / 200 MB per workspace). Images are shown with short-lived signed links from a **private** bucket.
- **Safe uploads:** the server checks the real file bytes (magic bytes, pixel size), requires the file name and browser type to agree, and refuses SVG and everything else. Files are stored as `<workspace>/<random id>.<ext>`; user file names are never used.
- **Database safety (migration 0006):** private `media` bucket with policy-checked paths, `register_media_asset()` as the only way to create library entries (checks the file exists in the caller's folder, validates metadata, enforces the size guard), unique file-to-entry mapping, `image.` usage-record prefix.
- **Stock photos:** `ImageSearchProvider` interface and a Pexels adapter (off until `IMAGE_PROVIDER` and `IMAGE_PROVIDER_API_KEY` are set). Search results show provider and photographer credit; "Add to library" re-reads the photo by id on the server and downloads only from `images.pexels.com` (HTTPS, size limit, no redirects). Per-user hourly limits: 20 searches, 10 imports. Licensing review in `docs/MEDIA_PROVIDERS.md`.
- **Images on posts:** each post page has an Image card (choose, upload and use, change, remove). One image per post; changing the image of an approved post moves it back to Draft.

### Files
New: `supabase/migrations/0006_media.sql`, `supabase/tests/rls_media.sql`, `docs/MEDIA_PROVIDERS.md`, `docs/decisions/0003-media-library.md`, `src/lib/media/{limits,image-inspect,paths,image-search,keys}.ts` (+ tests for inspect, paths, search), `src/lib/data/media.ts`, `src/lib/services/media.ts`, `src/app/app/media/{page.tsx,actions.ts}`, `src/components/media/{upload-form,media-grid,post-image-card}.tsx`.
Changed: `src/app/app/content/[itemId]/page.tsx`, `src/lib/services/errors.ts`, `src/lib/service-messages.ts`, `src/lib/security.test.ts`, `next.config.ts` (upload body limit), `.env.example`, `docs/{BUILD_PROGRESS,SUPABASE_SETUP,NEW_SESSION_START}.md`.
Deleted: none.

### Tests / checks and results
| Check | Result |
|---|---|
| Pure-logic tests (image inspection, paths, Pexels adapter with a fake network, safe download) plus all earlier pure tests, with a small stand-in runner under `tsx` | 215 passed, 0 failed |
| Real `vitest`, `lint`, full `typecheck`, `next build` | **NOT RUN** (no network). GitHub Actions is the real check |
| Partial typecheck | Only errors caused by missing React/Next packages remained |
| No Bengali text in source | PASS (scanned) |
| SQL migration 0006 and `rls_media.sql` | **NOT RUN** (no database in the sandbox) |
| Real upload, real storage, real Pexels call, browser use | **NOT RUN** |

### Risks / things to watch
- Storage policies and the SQL test were written without a database. In particular the test inserts into `storage.objects` directly; if Supabase's storage triggers reject that, the failure message will say so, and the test (not the policy) needs adjusting.
- Server actions have a request size limit set in `next.config.ts` (4.5 MB); Vercel's own limit is the same.
- EXIF/GPS data is not stripped from uploads.
- Deleting an image silently removes it from posts; scheduled posts are not built yet (Batch 9 must handle this).
- The Pexels summary comes from public pages read during this batch; re-read their guidelines before launch.

### Exact next action
Owner uploads the Batch 7 zip, confirms CI, runs `0006_media.sql` then `rls_media.sql` (expect the result row `ALL MEDIA TESTS PASSED`), uploads a small image, attaches it to a post, and (optional) turns on Pexels. Then start Batch 8 (Meta OAuth and Facebook Pages), which needs the owner's Meta developer app details first.

---

## Batch 6 — Campaign planner and bulk generation

**Status:** IN PROGRESS (code written; migration 0005 not applied; lint / typecheck / vitest / build not run in the sandbox; no real AI call and no database run).

### What was built
- **Plan a campaign** (`/app/campaigns/new`): project, topic or article link, optional angles (one per line, up to 20), start date, duration (7/14/30/60/90 days), number of posts (1 to 90), posting days, posting times (up to 4 per day), languages, formats, length, tone, audience, call to action, notes. **Preview calendar** shows the proposed dates before anything is saved; **Create campaign** saves it (no AI is used yet).
- **Deterministic calendar** (`src/lib/campaign-plan.ts`): spreads posts evenly over eligible days and times in the workspace timezone (daylight saving handled), skips times that already passed, rejects impossible plans with a clear message. Two languages alternate; each pair shares a format and an angle.
- **Campaign page** (`/app/campaigns/[id]`): progress bar, status, planned-posts table (date, language, format, status, link to the draft), buttons Start/Resume, Pause, Retry failed posts, Send drafts for review, Cancel.
- **Bulk generation in small rounds**: at most 3 posts per request (about 45 seconds), repeated by the open page; progress is stored in the database (`campaign_slots`, `campaigns.generation_progress`), so closing the page only pauses. Leases recover abandoned work; 3 attempts per post; the hourly per-user AI limit pauses the campaign instead of failing it.
- **Duplicate protection**: recent openings go into the prompt, three-word-run similarity check (retry with a different angle), and the existing content-hash unique index.
- **Safety**: slots and status changes are written only by `SECURITY DEFINER` functions (membership-checked, campaign row locked); browsers can no longer update `campaigns.status`. See `docs/decisions/0002-campaign-generation.md`.
- Test mode (`AI_MOCK=1`) now gives different sample text per campaign position, so the whole flow can be tried for free.

### Files
New: `supabase/migrations/0005_campaign_planner.sql`, `supabase/tests/rls_campaign_planner.sql`, `docs/decisions/0002-campaign-generation.md`, `src/lib/{campaign-plan,campaign-options,campaign-batch,campaign-failure,campaign-format,similarity}.ts` (+ tests), `src/lib/ai/mock.test.ts`, `src/lib/data/campaigns.ts`, `src/lib/services/campaigns.ts`, `src/app/app/campaigns/{actions.ts,new/page.tsx,[campaignId]/page.tsx}`, `src/components/campaigns/{campaign-form,campaign-runner,plan-table}.tsx`.
Changed: `src/app/app/campaigns/page.tsx`, `src/lib/ai/{mock,prompts,generate-post}.ts`, `src/lib/services/generation.ts` (exports and campaign context), `src/lib/data/{content,types}.ts`, `src/lib/status.ts`, `docs/{BUILD_PROGRESS,SUPABASE_SETUP,NEW_SESSION_START}.md`.
Deleted: none.

### Tests / checks and results
| Check | Result |
|---|---|
| Pure-logic tests (plan, similarity, batch rules, failure rules, formatting, mock, prompts) plus all existing pure tests, run with a small stand-in runner under `tsx` | 193 passed, 0 failed |
| Real `vitest`, `lint`, full `typecheck`, `next build` | **NOT RUN** (no network). GitHub Actions is the real check |
| Partial typecheck | Only errors caused by missing packages remained (React/Next types); real strictness errors (`noUncheckedIndexedAccess`) were found and fixed |
| No Bengali text in source | PASS (scanned) |
| SQL migration 0005 and `rls_campaign_planner.sql` | **NOT RUN** (no database in the sandbox). The test must be run by the owner |
| Real AI calls, real browser use of the progress panel | **NOT RUN** |

### Risks / things to watch
- The SQL functions and test were written without a database; a syntax or logic slip is possible. Send the exact message if the test prints `FAIL`.
- Tests used zod 3.23.8 here; the project asks for `^3.24`. CI uses the real one.
- Generation only advances while the campaign page is open (see ADR 0002).
- Default hourly limit (30 per user) means a 90-post campaign needs several resumes.
- `on delete set null (content_item_id)` needs PostgreSQL 15 or newer (current Supabase projects have it).

### Exact next action
Owner uploads the Batch 6 zip, confirms CI, runs `0005_campaign_planner.sql` then `rls_campaign_planner.sql` (expect `ALL CAMPAIGN PLANNER TESTS PASSED`), then tries a small campaign (for example 5 posts; test mode is fine), including Pause, Resume, Cancel, and closing the page mid-way. Then start Batch 7 (media and images).

---

## Batch 5 — URL extraction (articles to posts) + admin redesign

**Status:** IN PROGRESS (code written; migration 0004 not applied; lint / typecheck / vitest / build not run; no real web page and no real AI provider has been contacted). Batch 4 itself is still waiting for the owner's verification (its CI run failed once because `bilingual.tsx` was not yet deleted, which the owner was asked to do).

### Admin redesign (owner request)
Admin now has a sidebar shell (top tabs on phones) with Overview and AI providers. Overview shows a three-step setup checklist and provider status. The providers page has a summary strip (providers on, keys found, test mode), an "Order of use" line, and one card per provider with an on/off switch, model, priority, key status, and a Test connection panel. All text is American English.

### What was built (Batch 5)
- **Safe page reading** (`src/lib/extract/*`): URL validation (public http/https only, standard ports, no IP addresses, no localhost/internal names, no credentials), IPv4/IPv6 private-range detection including mapped, NAT64, 6to4, and Teredo forms, DNS answers all checked and the connection pinned to the validated address, redirects re-validated (no https-to-http), size/time/redirect limits, decompression limits, content-type checks, charset handling, robots.txt support (RFC-style rules, longest match, wildcards).
- **Readable text extraction** without dependencies: one linear pass (hostile input tested), removes scripts, styles, navigation, headers, footers, forms; decodes entities; finds title, description, site name, canonical link, language; detects paywalled and too-short or JavaScript-only pages.
- **Original-content guard**: prompt `post-v2` (source is untrusted data, rewrite in own words), and a six-word-sequence overlap check that rejects copied text (one repair attempt); the article link is appended to the post.
- **Source records** (`0004_source_documents.sql`): `source_documents` table, written only through `record_source_document()` (membership checked), read/delete by workspace members, cached for one hour per address, every attempt recorded; per-user and per-website hourly limits.
- **UI**: "Article link (optional)" on New post (prefilled for link projects), topic optional when a link is given, "Based on ..." in the editor, regeneration reuses the stored article, clear error messages for every failure kind.
- SQL test `supabase/tests/rls_sources.sql`.

### Files
New: `supabase/migrations/0004_source_documents.sql`, `supabase/tests/rls_sources.sql`, `src/lib/extract/*` (+ tests), `src/lib/data/sources.ts`, `src/lib/services/sources.ts`, `src/components/admin/{admin-nav,provider-card}.tsx`, `src/components/ui/switch.tsx`.
Changed: admin layout/pages/forms, `src/components/auth/fields.tsx`, `src/lib/ai/{post-schema,prompts,generate-post}.ts` (+ tests), `src/lib/services/{generation,errors}.ts`, `src/lib/data/{content,types}.ts`, `src/lib/{audit,service-messages,projects}.ts`, content form/actions/editor page, `.env.example`, docs.
Deleted/renamed: none.

### Tests / checks and results
| Check | Result |
|---|---|
| Executed with the stand-in runner: URL safety (11), safe fetcher with fake network (17), robots (9), overlap (5), HTML extractor (12), prompts (6), router (8), providers (8), copy rules (2), security scan (5), calendar, format, audit, permissions, redirects, route guard, timezones | 112 tests PASS |
| Written but NOT RUN (need installed zod/vitest): post schema, generate-post flow, content helpers, env, schemas, projects | NOT RUN |
| SQL tests (`rls_core_tables.sql` corrected, `rls_admin_ai.sql`, `rls_sources.sql`) | NOT RUN |
| Real network fetch of a web page | **Not done** (the real HTTP transport is untested here) |
| lint / typecheck / build / `npm install` | NOT RUN (no network) |
| Syntax of 163 TS/TSX files, imports, unused imports, partial typecheck | PASS (remaining type errors come only from missing installed packages) |

### Fix after the first CI run (owner reported)
`npm run build` in GitHub Actions failed on `/admin` with `SupabaseNotConfiguredError`: CI has no Supabase keys, and the new admin overview created a database client without first reading cookies, so Next.js tried to prerender it. Fixed in two ways: `createClient()` now reads cookies before checking configuration (any page that uses the database is automatically dynamic), and the admin layout is `force-dynamic`. Vercel was unaffected because its environment has the keys. Lesson: CI builds without Supabase variables, so every page that needs a user must be dynamic.

### Known issues / risks
- The real HTTP transport (`node-transport.ts`) and DNS resolver are the only extraction parts not exercised by tests; they need a real-world trial (try a public blog post, a 404, a PDF link, a paywalled page).
- Extraction is heuristic: some sites (heavy JavaScript, unusual markup) will fail with "not enough readable text". A site-specific or library-based extractor can be added later.
- Generation now includes a page fetch inside the same request; the combined limit is about 55 seconds. Slow sites plus a slow AI provider can time out (the user sees a retry message).
- Website-level crawling (reading several pages of a site) is not built; a "website" project uses one article link at a time.
- Reading pages on behalf of users carries legal and terms-of-service considerations; the product honors robots.txt, rewrites instead of copying, and links back to the source. A policy page should be written before launch.

### Exact next action
Owner: finish Batch 4 verification first (upload, delete `bilingual.tsx`, run `0003` + tests, add admin and a key). Then upload the Batch 5 zip, confirm CI, run `0004` and `rls_sources.sql`, and try: an English article link, a link that returns 404, a PDF link, a login/paywalled page, and a link to a private address (for example `http://localhost`) which must be refused. Report the results. Then Batch 6 (campaign planner and bulk generation).

---

## Batch 4 — AI adapter, admin section, single-post generation

**Status:** IN PROGRESS (code written; migration 0003 not applied; lint / typecheck / vitest / build not run — no network in the sandbox; no real AI provider has been called).

### Owner decisions applied
- Providers: Anthropic, OpenAI, Google Gemini, OpenRouter; any number can be switched on or off by an admin; free models when available, paid otherwise; keys supplied as Vercel environment variables.
- **Site language rule:** American native English everywhere; no Bengali text anywhere on the site. All Bengali UI text found in earlier batches was removed (language labels, the product preview, and the whole bilingual home-page section, which was replaced by a post-formats section). Date formats and labels switched to American. Recorded in plan section 23.4 and enforced by `src/lib/copy-rules.test.ts`.

### What was built
- **Provider-neutral AI layer** (`src/lib/ai/*`): one interface, adapters for the four providers (plain `fetch`, no new dependencies, keys sent in headers only), a deterministic mock provider (development/preview only, never production), and a router with priority order, bounded retries with backoff, fallback to the next provider, a total time budget, and safe error kinds (no keys or raw provider responses in errors).
- **Generation**: versioned English prompt (`post-v1`) that treats user text as data (injection-resistant), American English rules for English output and natural-Bengali rules for Bengali output, a strict JSON output schema (Zod), tolerant JSON extraction, a language check (Bengali script for `bn`, no Bengali for `en`), exactly one repair attempt, token usage totals, and fact-check flags for claims the author should verify.
- **Admin section** (`/admin`, platform admins only; everyone else sees 404): AI providers page with Active toggle, model, priority, "Key found / No key" status, and a Test connection button (about 20 tokens). Enabling a provider without a key is refused.
- **Posts**: New post page (AI generation with project, language, format, topic, length, tone, audience, CTA, notes; or write by hand), post editor with character count, hashtags, image idea, similar-wording warning, fact-check callout, approval workflow (draft -> needs review -> approved / rejected, back to draft, cancel), regenerate, and delete (drafts, rejected and canceled only). Editing an approved post moves it back to Draft.
- **Safety and cost controls**: per-user hourly generation limit (`AI_MAX_GENERATIONS_PER_HOUR`, default 30), usage recorded server-side through a membership-checked database function, audit events for post actions.
- **Database** (`0003_admin_and_ai.sql`): `platform_admins` (no browser access), `ai_provider_settings` (admin-only read/update), `get_enabled_ai_providers()`, `record_ai_usage()`, `is_platform_admin()`, plus update permission on the AI bookkeeping columns of `content_items`.
- SQL test `supabase/tests/rls_admin_ai.sql`.

### Files
New: `supabase/migrations/0003_admin_and_ai.sql`, `supabase/tests/rls_admin_ai.sql`, `src/lib/ai/*` (+tests), `src/lib/{post-formats,content,service-messages,copy-rules.test}.ts`, `src/lib/data/{ai-settings,content}.ts`, `src/lib/services/{generation,content,errors}.ts`, `src/lib/auth/admin.ts`, `src/app/admin/*`, `src/app/app/content/{actions.ts,new,[itemId]}`, `src/components/{admin,content}/*`, `src/components/ui/pending-button.tsx`, `src/components/marketing/post-formats.tsx`, `docs/NEW_SESSION_START.md`.
Changed: `.env.example`, `package.json` unchanged, `src/middleware.ts`, `src/lib/auth/route-guard.ts`(+test), `src/lib/{format,status,projects,audit,security.test}.ts`, `src/lib/services/projects.ts`, `src/lib/data/types.ts`, `src/components/{app/app-nav,app/profile-form,auth/fields,projects/project-form,marketing/product-preview}.tsx`, `src/app/layout.tsx`, `src/app/(marketing)/{page,pricing/page}.tsx`, `src/app/app/{layout,content/page,projects/[projectId]/page}.tsx`, docs.
**Deleted: `src/components/marketing/bilingual.tsx`** — drag-and-drop upload cannot delete files, so the owner must delete this one file on GitHub (it is no longer imported; leaving it is harmless but untidy).

### Database migrations
`0003_admin_and_ai.sql` — **not yet applied**. After applying: add yourself to `platform_admins` (SQL in `docs/SUPABASE_SETUP.md`).

### Tests / checks and results
| Check | Result |
|---|---|
| Executed with a tiny stand-in runner: router (8), providers with fake HTTP (8), prompts (4), copy rules (2), security scan (5), calendar, format, audit text, permissions, redirects, route guard, timezones | PASS (stand-in runner, not real vitest) |
| Written but NOT RUN (need installed zod/vitest): post schema, generate-post flow, content helpers | NOT RUN |
| SQL tests: `rls_core_tables.sql` (corrected) and `rls_admin_ai.sql` | NOT RUN |
| Real AI provider calls | **None made** |
| lint / typecheck / build / `npm install` | NOT RUN (no network) |
| Syntax of 144 TS/TSX files, import resolution | PASS |
| Partial typecheck | Remaining errors come only from missing installed packages |

### Known issues / risks
- Default model names are suggestions and may be out of date; fix them in Admin -> AI providers (the Test button shows "model name may be wrong").
- Generation runs inside a server action. The pages request a 60-second maximum run time; verify the Hobby plan allows it. If a provider is slow the request can time out; the user sees a retry message.
- Usage recording and the hourly limit rely on a database function callable by workspace editors; a malicious editor could only inflate their own usage. Hard quotas and plan limits arrive in the limits batch.
- Link and website projects need the topic typed by hand until URL extraction is built.
- Free OpenRouter models differ in quality, rate limits, and Bengali ability; test before relying on them.

### Exact next action
Owner: upload the Batch 4 zip and delete `bilingual.tsx`; confirm CI is green; run `0003` and `rls_admin_ai.sql`; re-run the corrected `rls_core_tables.sql`; add yourself as admin; add at least one AI key in Vercel and redeploy; turn a provider on and press Test; create a post in English and in Bengali and report the quality. Then Batch 5 (URL extraction) after approval.

---

## Batch 3 — Data model and dashboard

**Status:** IN PROGRESS. Owner verified: GitHub Actions green after upload, migration 0002 ran successfully in Supabase. The first run of `rls_core_tables.sql` stopped with `42501 permission denied for table campaigns` — a bug in the test script (it set the `id` column, which browser roles are deliberately not allowed to set), not in the migration. The test was corrected; waiting for the owner's re-run result.

### What was built
- Migration `0002_core_data_model.sql`: `content_projects`, `campaigns`, `content_items`, `media_assets`, `content_item_media`, `social_accounts`, `social_pages`, `scheduled_posts`, `job_queue`, `usage_records`, `audit_events` with RLS. Children use composite `(workspace_id, id)` foreign keys so a row can never reference another workspace's parent. Browser roles can write only projects, campaigns, content and media (editors and above; project/campaign delete is admin-only); viewers are read-only. Publishing state, queue, usage, and audit rows are not writable from browsers; `job_queue` payload/locks/errors are hidden. Audit rows are written only through `log_audit_event()`, which verifies membership and sets the actor from the session.
- RLS test script `supabase/tests/rls_core_tables.sql` (cross-workspace read/write, viewer role, forged workspace_id, cross-workspace foreign key, server-only tables, anon).
- Typed repository layer (`src/lib/data/*`, explicit row types, workspace always from the server session) and service layer with role checks and audit logging (`src/lib/services/*`).
- Pages: real dashboard (live counts, failed-post alert, campaign progress, getting-started checklist driven by real data), Projects (list, create, detail/edit, archive/restore, delete with confirmation), Campaigns (read-only list with progress), Content (status filters, list), Calendar skeleton (month grid in the workspace timezone, previous/next/today, scheduled list), Activity (audit history), Settings (from Batch 2). Pages and Media remain "Coming soon".
- Loading skeleton, empty states, error boundary, success/error notices (mapped from codes, not echoed from the URL).
- Project form validation: topics 2–200 chars; links/websites must be full http(s) addresses. (SSRF-safe fetching is part of the URL-extraction batch.)

### Files
New: `supabase/migrations/0002_core_data_model.sql`, `supabase/tests/rls_core_tables.sql`, `src/lib/data/*`, `src/lib/services/*`, `src/lib/{projects,status,format,calendar,audit}.ts` (+tests), `src/lib/auth/permissions.ts` (+test), `src/components/{ui/page-header,ui/empty-state,ui/stat-card}.tsx`, `src/components/projects/*`, `src/app/app/{projects,campaigns,content,calendar,activity}/*`, `src/app/app/loading.tsx`.
Changed: `src/app/app/page.tsx`, `src/lib/auth/session.ts` (adds `requireAppContext`, keeps owner's typing fix), `src/lib/site.ts`, `src/components/auth/fields.tsx` (adds textarea and checkbox fields), `docs/SUPABASE_SETUP.md`, `docs/BUILD_PROGRESS.md`.
Deleted/renamed: none.

### Database migrations
`0002_core_data_model.sql` — **not yet applied**.

### Tests / checks and results
| Check | Result |
|---|---|
| Pure-logic unit tests executed with a tiny stand-in runner (calendar, format, audit text, permissions, safe redirects, route guard, timezones: 21 tests) | PASS (this is not the real vitest) |
| Remaining vitest tests (zod schemas, projects form, env, security scan) | Written, **NOT RUN** |
| SQL RLS test for core tables | First run: test-script bug (see status); corrected version **awaiting re-run** |
| GitHub Actions (lint / typecheck / vitest / build) | PASS (owner-reported) |
| lint / typecheck / build / `npm install` | **NOT RUN** (no network) |
| Syntax of 101 TS/TSX files, import resolution, internal links, server-action export rule | PASS |
| Partial typecheck | Remaining errors all come from missing installed packages (React/Next types) |

Acceptance status: "CRUD works with authorization", "cross-workspace data is inaccessible" and the loading/empty/error/success states are **unproven** until the owner runs the migration and the RLS test, passes CI, and tries the pages on the deployed site.

### External setup required (owner)
Run migration 0002 and `rls_core_tables.sql` per `docs/SUPABASE_SETUP.md`. No new environment variables.

### Decisions
- Database types for the new tables are explicit row types in `src/lib/data/types.ts`, and queries use an untyped client, because the owner had to work around generated-type inference in Batch 2. Same approach avoids repeating the problem.
- Audit logging is best-effort: if it fails the user's action still succeeds.
- Projects that already have campaigns or posts cannot be deleted (archive instead), to prevent accidental loss of generated content.
- Provider tokens are not stored yet; they will go in a server-only table in the Meta batch.
- `email_events` is deferred to the Resend batch.

### Known issues / risks
- First CI run may show lint/type problems that could not be caught offline; send the log.
- The Pages and Media screens are placeholders until their batches.
- Content is read-only in this batch; the editor and generation arrive in Batch 4.

### Exact next action
Owner: upload the Batch 3 zip, wait for CI, run both SQL files, then try: create a project → edit → archive → restore → delete, view Activity, change calendar month. Report results (or paste errors). Then Batch 4 (AI adapter and single-post generation) after approval — it will need an AI provider choice and key.

---

## Batch 2 — Supabase and authentication

**Status:** DONE — verified by the owner: GitHub Actions green after the owner fixed two TypeScript typing errors (workarounds now merged into `src/app/app/actions.ts` and `src/lib/auth/session.ts`), migration 0001 and the RLS test ran successfully in Supabase (owner reported success; the exact result text was not quoted), Supabase↔Vercel integration supplied the environment variables, and sign-up → email → onboarding → dashboard works on the deployed site.

_Original build note (kept for history): code was first written without network access, so nothing had been executed._

### What was built
- Typed Supabase clients: browser, server (cookie-bound, RLS applies), middleware session refresh, and a server-only admin (service-role) client that nothing uses yet.
- Migration `supabase/migrations/0001_profiles_workspaces.sql`: `profiles`, `workspaces`, `workspace_members` (+ role enum), signup trigger that creates the profile, a personal workspace and the owner membership, membership helper function, RLS on all three tables, minimum table/column privileges (browser roles cannot insert/delete, cannot change `owner_id`, roles, or memberships).
- RLS isolation test script `supabase/tests/rls_tenant_isolation.sql` (run in the Supabase SQL Editor; rolls back).
- Auth: sign-up, log-in, log-out, forgot/reset password, email-link callback with PKCE code exchange and a graceful failure path. Generic error messages (no account enumeration), Zod validation, open-redirect protection on `next`.
- Route protection in middleware for `/app/*` and `/onboarding`; signed-in users are sent away from login/sign-up. If Supabase env vars are missing, the site still runs, sign-in pages say "not set up yet", and `/app` stays locked.
- Onboarding (`/onboarding`): name, workspace name, content language (English or Bengali), timezone (default Asia/Dhaka). Settings page (`/app/settings`) edits the same fields. Workspace is always taken from the server session, never from form input; updates verify that a row was actually changed.
- Dashboard now shows the real user and workspace. Fake "preview mode" zeros removed.

### Files
New: `supabase/` (migration + test), `src/middleware.ts`, `src/lib/supabase/*`, `src/lib/auth/*`, `src/lib/timezones.ts`(+test), `src/components/auth/*`, `src/components/app/profile-form.tsx`, `src/app/auth/{actions.ts,callback,forgot-password,reset-password}`, `src/app/onboarding`, `src/app/app/{actions.ts,settings,error.tsx}`, `docs/SUPABASE_SETUP.md`.
Changed: `package.json` (+`@supabase/ssr`, `@supabase/supabase-js`, `server-only`), `src/lib/env.ts`(+test), `src/lib/site.ts`, `src/app/app/layout.tsx`, `src/app/app/page.tsx`, `src/app/auth/login/page.tsx`, `src/app/auth/signup/page.tsx`, `docs/BUILD_PROGRESS.md`.
Deleted/renamed: none.

### Database migrations
`0001_profiles_workspaces.sql` — **not yet applied** to any project (owner runs it per `docs/SUPABASE_SETUP.md`).

### Tests / checks and results
| Check | Result |
|---|---|
| Unit tests: env, route guard, safe redirects, schemas, timezones, secret-handling scan | Written, **NOT RUN** |
| SQL RLS isolation test (cross-workspace read/write denied, anon denied, no browser writes to owner/role/membership) | Written, **NOT RUN** (needs the real Supabase project) |
| lint / typecheck / build / `npm install` | **NOT RUN** (no network) |
| Syntax of all 70 TS/TSX files, import resolution, internal links, server-action export rule | PASS |
| Partial typecheck | Only errors from missing `node_modules` types; none found in project logic |

Acceptance status: "Auth works with configured Supabase" and "RLS tests pass" are **unproven** until the owner runs the migration, the SQL test, and signs up on the deployed site. "Service-role key remains server-only" is enforced by an automated scan test (not yet run) and by the code: the key is referenced only in `src/lib/supabase/admin.ts`.

### External setup required (owner)
Follow `docs/SUPABASE_SETUP.md`: create the Supabase dev project, run the migration, run the RLS test, set Site URL and redirect URLs, add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_APP_URL` in Vercel, redeploy.

### Decisions
- `/onboarding` lives outside `/app` so the `/app` layout can require onboarding without a redirect loop and without moving Batch 1 files.
- MVP: one personal workspace per user; `workspace_members` is ready for teams but has no UI. Membership changes are server-only.
- Hand-written database types for now; regenerate from Supabase when the schema grows.
- No real emails are sent by LazyAI code; Supabase's own auth emails are used for testing (stop and ask before anything customer-facing).

### Known issues / risks
- Supabase built-in email is heavily rate-limited on the free plan; sign-up testing may hit it. Resend SMTP is Batch 10.
- Email links opened in a different browser than the sign-up browser cannot finish the PKCE exchange; the user is told to log in (the email is already confirmed) or request a new link.
- Library versions are caret ranges and unverified offline; Supabase SDK typings may need small fixes on the first CI run.
- Newer Supabase projects may label keys "publishable/secret" instead of "anon/service_role"; docs cover both.

### Exact next action
Owner: (1) confirm Batch 1 CI is green, (2) upload the Batch 2 zip, (3) complete `docs/SUPABASE_SETUP.md`, (4) report: CI result, `ALL RLS TESTS PASSED` (or the FAIL text), and whether sign-up → email → onboarding → dashboard works. Then Batch 3 (data model and dashboard) after approval.

---

## Batch 1 — App foundation

**Status:** IN PROGRESS (code written; lint / typecheck / tests / build **not yet run** — see below)

**Objective:** Next.js + strict TypeScript + Tailwind foundation, simple conversion-focused public homepage using the LazyAI logo, placeholder app shell, `.env.example`, README, GitHub CI.

### What was built
- Next.js 15 (App Router), React 19, TypeScript strict (+ `noUncheckedIndexedAccess`), Tailwind CSS 3, Zod, lucide icons.
- Brand: logo background cleaned (transparent PNGs for light and dark backgrounds), app icon, Apple icon, social share image. Colours ink `#0E1722` / blue `#006FFE`. Fonts: Inter, Plus Jakarta Sans, Noto Sans Bengali.
- Public site (`/`): header, hero with sample product preview, how-it-works, features, post-formats section, FAQ, final CTA, footer. Placeholder pages: `/pricing`, `/contact`, `/privacy`, `/terms`, `/auth/login`, `/auth/signup`, custom 404.
- App shell (`/app`): sidebar (desktop) / scrolling top nav (mobile), dashboard in clearly-labelled **preview mode** (zeros, no fake data), "Coming soon" pages for Projects, Campaigns, Content, Calendar, Pages, Media, Activity, Settings.
- `/api/health` (no secrets), `robots.txt`, `sitemap.xml`, basic security headers, `.env.example` with placeholders only.
- Copy rules followed: no invented prices, stats, or testimonials; sample content is labelled as a sample; "Published" is only described as confirmed-by-Facebook.
- GitHub Actions CI (`.github/workflows/ci.yml`): install, lint, typecheck, test, build.

### Files changed
New: everything under `src/`, `public/brand/`, `.github/workflows/ci.yml`, `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.env.example`, `README.md`.
Changed: `.gitignore`, `docs/LAZYAI_MASTER_PLAN.md` (added section 23), `docs/BUILD_PROGRESS.md`.
Deleted/renamed: none.

### Database migrations
None.

### Tests / checks and results
| Check | Result |
|---|---|
| Unit tests written (`cn`, env resolution, site config, health route) | Written, **NOT RUN** (no network in sandbox) |
| `npm install` / `lint` / `typecheck` / `build` | **NOT RUN** (no network in sandbox) |
| Syntax check of all 41 TS/TSX files (TypeScript transpiler) | PASS, 0 errors |
| All `@/` and relative imports resolve to real files | PASS |
| All internal links point to existing routes | PASS |
| Partial typecheck without dependencies installed | Only errors caused by missing `node_modules` (React/Next/Node types) remained; none found in project logic |
| Secrets in repo | None (placeholders only) |

These partial checks are **not** a substitute for the real ones. Batch 1 is only DONE once GitHub Actions is green and a Vercel build succeeds.

### External setup still required (owner)
1. Upload the batch zip to GitHub (see README) and wait for the **Actions** run.
2. Import the repo into Vercel (Hobby) and confirm the build succeeds. Set `NEXT_PUBLIC_APP_URL` to the Vercel URL.
3. Supabase, Resend, AI, Meta, Cloudflare are **not** needed yet.

### Decisions made
- Free tiers and Vercel Hobby until commercial launch (owner).
- GitHub browser drag-and-drop uploads with a 100-file limit per upload (owner) — recorded in plan section 23.
- Dependencies use caret version ranges, unverified here (no network). If CI fails on a version, send the log and it will be pinned.
- No `package-lock.json` yet (cannot be generated here); CI/Vercel use `npm install`.
- Marketing and app stay on one domain for the MVP.

### Known issues / risks
- First CI run may surface lint/type/version problems that could not be caught offline. They will be fixed before Batch 2.
- `next/font/google` downloads fonts at build time (works on Vercel/GitHub; not in the offline sandbox).
- Privacy/Terms/Contact/Pricing are placeholders and must be written before public launch.
- Sign-in links go to "not available yet" pages until Batch 2.

### Exact next action
Owner uploads the zip, reports the CI and Vercel results (green, or paste the error log). On green and approval, start **Batch 2 — Supabase and authentication** (needs the Supabase project URL and anon key; service-role key stays server-only).

---

## Batch 0 — Repository inspection and plan

**Status:** DONE

- Repository was empty (greenfield). Toolchain: Node 22, npm 10, git 2.43. Sandbox has no network.
- Uploaded logo had a fake checkerboard background baked in; cleaned in Batch 1.
- ADR-0001: Next.js App Router + PostgreSQL-backed job queue (`docs/decisions/0001-framework-and-queue.md`).
- Owner answers: GitHub via browser drag-and-drop (100-file limit); Vercel Hobby; free tiers until launch.
- Files: `docs/LAZYAI_MASTER_PLAN.md`, `docs/BUILD_PROGRESS.md`, `docs/decisions/0001-framework-and-queue.md`, `docs/brand/LogoLogo.source.png`, `.gitignore`.

---

## Batch 14: writing engine fixes and simpler posts (code written, NOT yet verified)

**Owner requests covered:** 1 (images in campaigns + stock keys in Admin), 2 (500-750 word length), 5 (writing continues with the browser closed), 6 (no review/approve), 9 (OpenRouter model).

**What changed**
- **Migration `0014`** (run in Supabase SQL Editor, then `supabase/tests/rls_background_generation.sql`, expect `ALL BACKGROUND GENERATION TESTS PASSED`): campaign functions accept the service role (background writer); `system_schedule_post`, `system_register_media_asset` (service role only); posts default to `approved` ("ready") and old draft/awaiting/rejected posts become ready.
- **No review step:** statuses shown as Ready / Canceled; saving or attaching an image no longer changes status; "Submit for review" and campaign "send for review" removed; marketing, help and legal wording updated.
- **Length:** new `extra_long` (500 to 750 words); AI token budget per length and language (`maxTokensFor`); body limit raised to 9000 characters.
- **Stock photos:** `Admin -> Stock photos` (encrypted keys, Pexels + Pixabay, test button); `lib/media/stock-providers.ts`, `stock-query.ts`, `data/stock-settings.ts`; `lib/media/keys.ts` now only reads environment fallbacks. Photo references are now `pexels:ID` / `pixabay:ID`. Downloads follow at most 2 redirects, only inside the provider's hosts.
- **Campaign extras:** form fields "Add a free stock photo" and "Schedule each post automatically" (off by default) with a Page picker; stored in the campaign brief (`auto_image`, `auto_schedule`, `page_id`). `services/campaign-finish.ts` adds the photo and schedules at the planned time after each post.
- **Background writing:** `services/campaign-worker.ts` is called by `/api/cron/dispatch` after publishing. Campaign page tells people whether background writing is active (scheduler heartbeat).
- **OpenRouter:** default model `openrouter/free`; admin hint.

**Tests added/changed:** `stock-query.test.ts`, `post-formats.test.ts`, Pixabay cases in `image-search.test.ts`, `content.test.ts` rewritten for the new status rules.

**Verified in the build sandbox (no network):** TypeScript syntax check of every file (0 errors); every import resolves to a file; pure tests `stock-query` and `post-formats` pass with a stand-in runner.
**NOT verified:** npm install, lint, full typecheck, vitest, build, the SQL (not run on a database), real Pexels/Pixabay calls, real AI calls, real scheduling.

**Risks to check first**
1. Run `0014` before deploying the code (the code assumes the new functions exist).
2. The service-role check reads `request.jwt.claims`; the SQL test confirms it works on your project.
3. Automatic scheduling publishes AI text without a person reading it. It is off by default; real posting still needs Admin -> Publishing switched on.
4. Pixabay's image host redirects were handled defensively, but not tested against the live service.

**Next:** Batch 15 (plans, pricing page, bKash).

### Batch 14.1 (Unsplash, parallel stock search, optional Pexels)
Unsplash provider (with required download reporting), all enabled providers searched in parallel with mixed results, Pexels optional, env fallbacks `UNSPLASH_ACCESS_KEY` / `PIXABAY_API_KEY` / `PEXELS_API_KEY`, new tests. No new migration.
