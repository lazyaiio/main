# ADR-0001: Framework, hosting, and background-job approach

- **Date:** 2026-10-20
- **Status:** Accepted (queue dispatcher choice revisited in Batch 9)

## Context
Greenfield project. Required stack from the plan and user: GitHub → Vercel, Supabase (Postgres/Auth/Storage), Resend. Must support Bengali + English, long-running campaign generation, and time-accurate publishing to Facebook Pages.

## Options
**Framework:** (a) Next.js App Router + TypeScript, (b) Remix/SvelteKit, (c) separate SPA + API.
**Queue:** (a) PostgreSQL job table in Supabase claimed with `FOR UPDATE SKIP LOCKED`, (b) managed queue (e.g. QStash/Inngest), (c) in-request processing.

## Decision
- **Next.js (App Router), TypeScript strict, Tailwind, Zod** — best fit for Vercel, one codebase for UI and server routes.
- **Postgres-backed durable `job_queue`** with leases and idempotency keys as the source of truth. No bulk work inside a single request.
- A cron-triggered dispatcher claims small bounded batches. Vercel Cron on Hobby is limited in frequency/precision, so exact minute-level publishing is **not assumed**; Batch 9 re-evaluates a managed scheduler (e.g. Supabase pg_cron, QStash) once the Vercel plan is known.

## Consequences
- No extra infra beyond Supabase + Vercel to start.
- Publishing precision depends on the dispatcher; UI must say "scheduled in LazyAI", never imply Facebook-native scheduling.
- Swapping in a managed queue later only touches the dispatcher, not the data model.
