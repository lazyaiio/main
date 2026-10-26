# LazyAI: start-a-new-chat handoff

Give this file to Claude at the start of a new chat, together with `lazyai-full-snapshot.zip` (the whole project) and `LAZYAI_MASTER_PLAN.md`. Claude has no memory of the previous chat's files, so everything it needs is here and in the snapshot.

## 1. Message to paste into the new chat

> Read `NEW_SESSION_START.md` and `LAZYAI_MASTER_PLAN.md` first, then unzip `lazyai-full-snapshot.zip` and compare it with the zip(s) I upload now (I may have fixed errors myself). Continue the LazyAI build from where it stopped, one batch at a time. I will tell you the results of my checks below.
>
> My results so far: *(write: GitHub Actions green or red + error log; SQL scripts run and their exact results; what you tried on the site; any fixes you made yourself)*

## 2. Who the owner is and how to work with them

- The owner writes in **Bengali** (mixed with English). **Reply to the owner in Bengali.** Keep explanations simple, step by step, and say exactly which button or file to use.
- **The product's text is never Bengali.** All site text (public site, dashboard, admin, emails, errors, labels, alt text, metadata) is **American native English**, with American spelling and date formats. Writing posts in Bengali is a product feature (user content), but no Bengali characters may appear in source files or UI. `src/lib/copy-rules.test.ts` enforces this. Bengali sample data in code must use `\u` escapes.
- Design: **simple and lucrative** (clean, conversion-focused, uncluttered, fast, mobile-friendly, accessible). Brand colors: ink `#0E1722`, blue `#006FFE`. Use the supplied logo everywhere (`public/brand/logo.png`, `logo-light.png`; icon/OG image in `src/app/`).
- Be honest about verification. Never say "done", "passing", or "works" for something that was not executed. Say what was and was not run.

## 3. Hard constraints

- **Upload method:** the owner puts files on GitHub by **browser drag and drop**, which allows **at most 100 files per upload** and cannot delete files. So: deliver each batch as a zip with **fewer than 100 files** containing **only new and changed files** (preserve folder paths, no wrapper folder); if more are needed, split into `part1`, `part2`. List files the owner must **delete manually**. Mention hidden files (`.github/`, `.gitignore`, `.env.example`). Never ask the owner to use git or a terminal.
- **Free tiers until commercial launch:** Vercel Hobby, Supabase free, Resend free, etc. Design for their limits; keep a free-to-paid checklist for before launch.
- **Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind 3, Zod, Supabase (Postgres, Auth, RLS), Vercel (via GitHub), Resend (later), plain `fetch` for AI providers.
- **The build sandbox has no network**, so `npm install`, lint, typecheck, build, and real vitest cannot run there. What can be done: syntax check with the TypeScript transpiler, import and link checks, a partial typecheck (ignore errors caused by missing packages), and running pure-logic tests with a small stand-in test runner under `tsx`. The owner's GitHub Actions run is the real verification; ask for its result and logs. Dependencies use `^` ranges and are unverified offline.
- **Stop and ask for approval before:** production DNS changes, live publishing to Facebook, real customer emails, paid operations (including real AI calls beyond tiny tests), or any irreversible action.
- **Secrets:** never put keys in the repo or chat. Supabase service-role key and AI keys live only in Vercel environment variables. Server-only modules start with `import "server-only"`. The security test (`src/lib/security.test.ts`) guards this.

## 4. Project state (end of the last chat)

| Batch | Topic | State |
|---|---|---|
| 0 | Inspect + plan | Done |
| 1 | App foundation, landing page, shell, CI | Done (owner verified) |
| 2 | Supabase auth, profiles, workspaces, RLS | Done (owner verified; owner fixed two typing errors, already merged) |
| 3 | Core data model, projects, content list, calendar, activity, dashboard | CI green; migration 0002 applied; the **first** `rls_core_tables.sql` run failed because of a bug in the test script (it set `id` from the browser role); the **corrected** script was delivered and its re-run result is not yet known |
| 4 | AI layer, admin section, single-post generation | **Code written, owner verification pending.** CI failed once only because the old `bilingual.tsx` file had not been deleted (the copy-rules test caught Bengali text in it); the owner was told to delete it. Migration 0003 and its SQL test status unknown. No real AI call confirmed |
| 5 | URL extraction (+ admin redesign) | **Code written, nothing verified.** Migration 0004 not applied; real HTTP transport untested |
| 6 | Campaign planner and bulk generation | Migration 0005 and SQL test verified by owner (`ALL CAMPAIGN PLANNER TESTS PASSED`). CI result and browser trial of the progress panel not yet reported |
| 7 | Media and images | Done per owner report (0006 + SQL test run, steps done). Thumbnails added in Batch 8 |
| 8 | Meta OAuth and Facebook Pages | Done per owner report (0007/0008 run, Meta app created, steps done). Owner approved live Facebook *connection* work only |
| 9 | Durable scheduler and publishing (+ legal pages, Meta data-deletion callbacks) | **Code written, owner verification pending.** Migrations 0009/0010 and SQL tests not yet run; scheduler not yet set up; **real Facebook posting is gated by the Admin -> Publishing switch (migration 0011) and needs the owner's explicit approval** |
| 10 | Resend and email (+ publishing diagnostics follow-up) | **Code written, owner verification pending.** Migrations 0011/0012 and SQL tests not yet run; Resend not yet set up |
| 11 | Usage limits and hardening (+ account deletion/export) | Not started (next, after Batch 10 is verified) |
| 12 | Deployment and DNS runbook | Not started |
| 13 | Release readiness | Not started |

`docs/BUILD_PROGRESS.md` is the detailed log for each batch (what was built, files, tests, risks, next action). Update it at the end of every batch.

### What the owner still has to do (ask for the results first)
**Batch 4:** upload the Batch 4 zip and delete `src/components/marketing/bilingual.tsx` on GitHub; confirm CI is green; run `0003_admin_and_ai.sql` then `rls_admin_ai.sql` (expect `ALL ADMIN/AI TESTS PASSED`); re-run the corrected `rls_core_tables.sql` (expect `ALL CORE RLS TESTS PASSED`); make themselves a platform admin (SQL in `docs/SUPABASE_SETUP.md`); add an AI key in Vercel (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `OPENROUTER_API_KEY`), redeploy, turn a provider on in Admin and press Test; write an English and a Bengali post and judge quality.
**Batch 5:** upload the Batch 5 zip; confirm CI; run `0004_source_documents.sql` then `rls_sources.sql` (expect `ALL SOURCE TESTS PASSED`); try an English article link, a 404 link, a PDF link, a paywalled/login page, and `http://localhost` (must be refused); report results.

## 5. Architecture and conventions (follow these)

- **Layers:** `src/lib/data/*` (database queries, explicit row types in `types.ts`, untyped Supabase client on purpose because generated-type inference caused CI errors), `src/lib/services/*` (permission checks + audit + business rules, throw `ServiceError` with safe messages), `src/app/**/actions.ts` (server actions: validate with Zod, call services, redirect with `?notice=` / `?error=<code>`; never echo raw text from the URL), pages are server components using `requireAppContext()`.
- **The workspace always comes from the server session** (`ctx.workspace.id`), never from form input. Every query also filters by `workspace_id`, and RLS enforces it again.
- **Database rules:** every tenant table has `workspace_id` and RLS; children use composite `(workspace_id, id)` foreign keys; browser roles get column-level grants only (they cannot set `id`, `workspace_id` on update, `created_by`, status/usage/queue/audit fields); trusted writes go through `SECURITY DEFINER` functions that check membership (`log_audit_event`, `record_ai_usage`). New migrations are numbered files in `supabase/migrations/` with a matching SQL test in `supabase/tests/`. The owner runs them in the Supabase SQL Editor.
- **Roles:** owner/admin/editor can write, viewer is read-only; only owner/admin can delete projects. Platform admins (table `platform_admins`, SQL-only) can open `/admin`.
- **AI layer** (`src/lib/ai/`): provider interface + 4 adapters + mock, router (priority, bounded retries, fallback, time budget), prompts (`PROMPT_VERSION`), schemas, one repair attempt. Keys are read only in `ai/keys.ts`. Provider and model settings live in the `ai_provider_settings` table; usage in `usage_records`.
- **UI patterns:** `PageHeader`, `EmptyState`, `StatCard`, `Badge`, `Button/ButtonLink`, form fields in `components/auth/fields.tsx`, `useActionState` forms with `FormState`. Every page needs loading, empty, error, and success states.
- **Tests:** vitest files next to the code (`*.test.ts`). Pure logic is tested without network or database. Run SQL tests by asking the owner.
- **Known lessons:** (a) a test that inserts an `id` as the browser role fails by design; (b) `redirect()` must not be inside `try/catch`; (c) Next 15 `params` and `searchParams` are Promises; (d) `next/font/google` needs network at build (fine on Vercel); (e) server actions that call AI export `maxDuration = 60` from the hosting page; (f) SSRF rules are strict on purpose (no IP literals, only ports 80/443); (g) tests that repeat identical paragraphs get de-duplicated by the HTML extractor.

## 6. Batch 6 (campaign planner and bulk generation): code written; Batch 7 is next after the owner verifies it

(Batch 6 notes below are kept for reference. Verification still needed: upload zip, CI green, run `0005_campaign_planner.sql` + `rls_campaign_planner.sql`, try a small campaign. See `docs/BUILD_PROGRESS.md` and `docs/decisions/0002-campaign-generation.md`.)

Read the Batch 6 section of `LAZYAI_MASTER_PLAN.md` first. Only start it after the owner reports Batch 4 and 5 results (fix whatever failed first). Reuse what exists: `src/lib/ai` (router, prompts, validation, overlap guard), `services/generation.ts` (single-post generation, usage recording, per-user hourly limit), the `campaigns`, `content_items` and `job_queue` tables from migration 0002, the approval workflow in `lib/content.ts`, and `services/sources.ts` for article links. Campaign generation must run in small resumable batches (not one long request), record progress in `campaigns.generation_progress`, avoid duplicates (`content_hash`), and respect the per-user/hour limits. The queue writes need trusted server code (migration functions), since browsers cannot write `job_queue`. Same method as before: inspect uploaded changes first, build, run what can be run, update `docs/BUILD_PROGRESS.md`, deliver a changed-files zip (under 100 files, list deletions), and stop for the owner's verification.

## 7. File map

- `docs/LAZYAI_MASTER_PLAN.md` the plan (section 23 holds the owner's constraints, language rule, AI provider decisions)
- `docs/BUILD_PROGRESS.md` per-batch log; `docs/SUPABASE_SETUP.md` owner setup steps; `docs/decisions/` ADRs
- `supabase/migrations/0001..0004_*.sql`, `supabase/tests/*.sql`
- `src/app/(marketing)` public site; `src/app/auth` sign-in flows; `src/app/onboarding`; `src/app/app` signed-in product; `src/app/admin` admin; `src/middleware.ts` route protection
- `src/lib/{ai,auth,data,extract,services,supabase}` as described above (`extract/` = safe web page reading: URL/IP safety, pinned-address fetcher, robots.txt, HTML text extraction, copy-overlap check); `src/components/*`
- `.github/workflows/ci.yml` (install, lint, typecheck, test, build), `.env.example` (all variable names, no values)
