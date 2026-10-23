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
| 6 | Campaign planner and bulk generation | **IN PROGRESS** — code written, not yet verified |
| 7 | Media and images | NOT STARTED |
| 8 | Meta OAuth and Facebook Pages | NOT STARTED |
| 9 | Durable scheduler and publishing | NOT STARTED |
| 10 | Resend and email | NOT STARTED |
| 11 | Usage limits and hardening | NOT STARTED |
| 12 | Deployment and DNS runbook | NOT STARTED |
| 13 | Release readiness | NOT STARTED |

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
