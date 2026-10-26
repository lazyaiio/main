# ADR 0005: Scheduling, the publishing queue, and safe publishing

Status: accepted (Batch 9)

## Context
Posts must go out at the scheduled time without duplicates, even when a request dies halfway, and without anything being posted by surprise. Vercel Hobby cron runs once a day; Facebook does not offer an idempotency key for feed posts.

## Decision
- `scheduled_posts` is the queue. Browsers can only read it. People use membership-checked SECURITY DEFINER functions (`schedule_post`, `reschedule_post`, `cancel_scheduled_post`, `retry_failed_post`, `mark_post_published_manually`). Only **approved** posts can be scheduled, only on **connected** Pages where the person can post, never in the past or over a year ahead; one live entry per post and Page (partial unique index).
- The dispatcher uses functions callable only with the service-role key (`claim_due_posts`, `finish_post_published`, `finish_post_retry`, `finish_post_failed`, `release_post`). Claiming uses row locks with SKIP LOCKED, so concurrent runs cannot hand out the same post.
- **No automatic retry when the outcome is unknown.** If an attempt started but never reported back (lease expired), or Facebook's answer cannot tell us whether the post was created (timeout, 5xx, answer without an id), the post becomes `failed` with `uncertain_result`. A person checks the Page and chooses "It is on my Page" or "post it again". Only refusals that clearly created nothing (rate limit, temporary pre-send problems) are retried, with delays of 1 min, 5 min, 15 min, 1 h, and 3 h, up to 5 attempts.
- Permanent problems (expired access, missing permission, lost Page role, rejected content) fail at once; Page problems are also shown on the Pages screen.
- Posts more than 6 hours late are not published silently (`missed_window`).
- At publish time the dispatcher re-checks that the post is still approved and the Page is still connected. Disconnecting a Page (or removing the app on Facebook) cancels its pending posts.
- **Triggering:** Supabase `pg_cron` + `pg_net` call `/api/cron/dispatch` every minute (free); Vercel's daily cron is a safety net. The endpoint requires `Authorization: Bearer <CRON_SECRET>` and fails closed.
- **Live gate:** real Facebook posting only happens when a platform admin switches it on in Admin -> Publishing (stored in `platform_settings`, migration 0011; `LIVE_PUBLISHING_ENABLED=0` in the environment is an emergency stop). The pretend Facebook (test mode) always works. Every scheduler run leaves a heartbeat so the Admin screen shows whether the scheduler is alive. Until the gate is open nothing is claimed, so posts are not consumed or failed.
- Text posts and photo posts are supported (photo caption = post text). Link posts rely on the link in the text. Facebook's own scheduled-post feature is not used, so edit and cancel stay in LazyAI's control.

## Consequences
- Timing precision is about one minute (the cron interval).
- A rare "uncertain" post needs one human click, by design: a missed post is better than a duplicate.
- Publishing results are visible on the post page and the calendar; failures are explained in plain English.
