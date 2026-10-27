# ADR 0007: Plan limits in the database, rate limiting, deletion, and logging hygiene

Status: accepted (Batch 11)

## Decision
- **Plans** (`plans` table) hold named limits; `workspaces.plan` and `limit_overrides` choose them. Browsers cannot change either (column-level grants), only platform admins through `set_workspace_plan`.
- **Where limits bite:** posts and connected Pages by BEFORE INSERT triggers; images by `register_media_asset`; open campaigns by `create_campaign_with_slots`; AI posts per month by the server before each generation (AI keys exist only on the server, so there is no direct path). Services translate the database's "limit reached" (error 53400) into plain English; a campaign that hits a limit pauses instead of failing.
- **Rate limits:** `rate_limit_hit(action, limit, window)` is a fixed-window counter keyed by action and the signed-in person (the key cannot be forged for someone else). Infrastructure errors fail open so a database hiccup never blocks people; abuse protection for AI and URL fetching already existed.
- **Deletion:** deleting the sign-in account cascades through workspaces (their `owner_id` references the account) to all tenant data; image files are removed first by the app because storage is not part of database cascades. Password re-entry, a typed confirmation, and a refusal while other members exist guard it. Tested at the database level.
- **Export:** collected with the person's own session (row security decides scope), then narrowed by a per-table allow-list; secret-looking columns are dropped even if listed.
- **Logging:** one logger redacts by key name and by value shape; audit metadata passes through the same redactor. A project-wide secret scan runs inside the test suite.
- **Headers:** only directives that cannot break the app are added. A script-blocking CSP is deferred (needs nonces and cross-browser testing).

## Consequences
- Limits can be changed without a deploy (SQL or Admin -> Plans).
- Counters are per person and per window, not a distributed token bucket; good enough for abuse protection at this scale.
- Members management is not built yet, so "other members" blocking account deletion is a safeguard for the future.
