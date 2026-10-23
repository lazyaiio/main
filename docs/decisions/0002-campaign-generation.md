# ADR 0002: Campaign generation runs in small, resumable rounds

Status: accepted (Batch 6)

## Context
A campaign can have up to 90 posts. One web request on Vercel Hobby may run at most 60 seconds, and Vercel cron on Hobby runs at most once a day, so a single long request or a background worker is not possible yet (the durable scheduler comes in Batch 9).

## Decision
- A campaign is stored with one `campaign_slots` row per planned post (date, language, format, optional angle). The slots are the work queue for generation. `job_queue` stays reserved for publishing (Batch 9).
- Browsers can read slots but never write them. Every change goes through `SECURITY DEFINER` functions that check workspace membership and lock the campaign row (`create_campaign_with_slots`, `start/pause/cancel_campaign`, `claim_campaign_slots`, `complete/release_campaign_slot`, `retry_failed_slots`). Browsers can no longer update `campaigns.status`.
- Generation happens in rounds: the open campaign page calls a server action that claims at most 3 slots, writes them (about 45 seconds budget), saves each post as a draft, and returns the progress. The page repeats until the campaign is finished or paused. Closing the page only pauses the work; reopening and pressing Resume continues.
- A claimed slot has a 90-second lease. If the request dies, the lease expires and the slot is offered again. Each slot has at most 3 attempts, then it is marked failed and can be retried by the user.
- Duplicates are prevented three ways: the prompt lists recent openings to avoid, a three-word-run similarity check rejects near-copies (retried with a "different angle" note), and the existing unique `(campaign_id, content_hash)` index is the last line of defense.
- The hourly per-user AI limit is checked before each round. When it is reached the campaign pauses with a clear message; no progress is lost.
- The calendar is built by a pure, deterministic function (`src/lib/campaign-plan.ts`), so the preview and the saved plan are identical, and it is fully unit-tested (time zones, daylight saving time, 90-day plans).
- Only manual approval is offered. Posts are drafts; a button sends all drafts of a campaign to review.

## Consequences
- Generation only advances while someone has the campaign page open. Batch 9 (durable scheduler) will add background continuation.
- With two languages, posts alternate between languages and each pair shares a format and an angle. "Every post in both languages" can be added later.
- A campaign's posts are not scheduled on pages yet; the planned dates live in the slots until Batch 8/9 connects Facebook Pages.
