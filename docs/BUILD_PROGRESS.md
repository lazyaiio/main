# LazyAI — Build Progress

Source of truth for build status. Updated at the end of every batch.
Plan: [`LAZYAI_MASTER_PLAN.md`](./LAZYAI_MASTER_PLAN.md) (see section 23 for owner constraints)

## Summary

| Batch | Title | Status |
|---|---|---|
| 0 | Repository inspection and plan | DONE |
| 1 | App foundation | **IN PROGRESS** — code complete, waiting for CI/Vercel verification |
| 2 | Supabase and authentication | **IN PROGRESS** — code written, not yet verified |
| 3 | Data model and dashboard | NOT STARTED |
| 4 | AI adapter and single-post generation | NOT STARTED |
| 5 | URL extraction | NOT STARTED |
| 6 | Campaign planner and bulk generation | NOT STARTED |
| 7 | Media and images | NOT STARTED |
| 8 | Meta OAuth and Facebook Pages | NOT STARTED |
| 9 | Durable scheduler and publishing | NOT STARTED |
| 10 | Resend and email | NOT STARTED |
| 11 | Usage limits and hardening | NOT STARTED |
| 12 | Deployment and DNS runbook | NOT STARTED |
| 13 | Release readiness | NOT STARTED |

---

## Batch 2 — Supabase and authentication

**Status:** IN PROGRESS (code written; nothing executed against a real Supabase project, and lint / typecheck / tests / build not run — no network in the sandbox). Started at the owner's request before the Batch 1 CI result was reported, so Batch 2 also depends on Batch 1 being green.

### What was built
- Typed Supabase clients: browser, server (cookie-bound, RLS applies), middleware session refresh, and a server-only admin (service-role) client that nothing uses yet.
- Migration `supabase/migrations/0001_profiles_workspaces.sql`: `profiles`, `workspaces`, `workspace_members` (+ role enum), signup trigger that creates the profile, a personal workspace and the owner membership, membership helper function, RLS on all three tables, minimum table/column privileges (browser roles cannot insert/delete, cannot change `owner_id`, roles, or memberships).
- RLS isolation test script `supabase/tests/rls_tenant_isolation.sql` (run in the Supabase SQL Editor; rolls back).
- Auth: sign-up, log-in, log-out, forgot/reset password, email-link callback with PKCE code exchange and a graceful failure path. Generic error messages (no account enumeration), Zod validation, open-redirect protection on `next`.
- Route protection in middleware for `/app/*` and `/onboarding`; signed-in users are sent away from login/sign-up. If Supabase env vars are missing, the site still runs, sign-in pages say "not set up yet", and `/app` stays locked.
- Onboarding (`/onboarding`): name, workspace name, content language (English/বাংলা), timezone (default Asia/Dhaka). Settings page (`/app/settings`) edits the same fields. Workspace is always taken from the server session, never from form input; updates verify that a row was actually changed.
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
- Public site (`/`): header, hero with sample product preview, how-it-works, features, bilingual EN/বাংলা section, FAQ, final CTA, footer. Placeholder pages: `/pricing`, `/contact`, `/privacy`, `/terms`, `/auth/login`, `/auth/signup`, custom 404.
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
