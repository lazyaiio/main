# LazyAI.io — Master Product Plan & Claude Development Guide

**Document purpose:** A complete product specification and incremental implementation plan for Claude to build LazyAI in batches.

**Brand:** LazyAI  
**Domain:** `lazyai.io`  
**Tagline:** Work less. Publish more.  
**Initial platform:** Facebook Pages  
**Initial languages:** English and Bengali  
**Preferred stack:** GitHub → Vercel + Supabase  
**Email:** Resend  
**DNS:** Cloudflare authoritative DNS, with Vercel hosting the application  
**Development style:** Claude-assisted, incremental batches, tested after each batch

## How to start with Claude

Upload this file to Claude in the project/repository context and say:

> Start building LazyAI according to `LAZYAI_MASTER_PLAN.md`. First inspect the existing repository and complete Batch 0 only. Then work through the batches in order, one batch at a time. Preserve existing functionality, run the relevant checks after each batch, update `docs/BUILD_PROGRESS.md`, and stop for my approval whenever a real external account action, production change, irreversible operation, or business decision is required. Do not pretend an integration is live if credentials or approvals are missing.

---

# 1. Product vision

LazyAI is an AI-powered SaaS that helps creators, bloggers, small businesses, and marketing teams plan, write, organize, and publish social media content with less manual work.

A user can provide:
- A keyword or core topic.
- A single article URL.
- A website homepage or sitemap.
- A list of topics imported from CSV.
- A business description, audience, and content goals.

LazyAI creates a content strategy, proposes a calendar, generates original posts in English or Bengali, attaches an appropriate image when available, and schedules approved posts for connected Facebook Pages. Later, the product can expand to additional languages and supported social platforms.

### Product promise

“Give LazyAI a topic or website. Get a useful content plan, review the posts, and publish them on schedule.”

### Important status distinction

The application must distinguish:
1. Content generated.
2. Draft saved.
3. Content approved.
4. Scheduled inside LazyAI.
5. Submitted to a social platform for native scheduling, if supported.
6. Published successfully and confirmed by the platform.
7. Failed or awaiting retry.

Never show “Published” or “Scheduled on Facebook” without a confirmed API result. A LazyAI scheduled item means that LazyAI intends to attempt publication at that time; it does not necessarily mean Facebook already has a native scheduled post.

## 1.1 MVP non-goals

Do not build every possible feature in the first release. The MVP should focus on:
- Topic/keyword, article URL, and website-based content workflows.
- English and Bengali.
- Facebook Pages only.
- Single-post and bulk campaign generation.
- Review/edit/approval.
- Images.
- Scheduling, publishing, status, and retry.
- Basic usage tracking and transactional emails.

Defer other social platforms, agency white-label, advanced analytics, video creation, a full blog CMS, and complex team permissions until the core workflow is reliable.

---

# 2. Target users and key workflows

## Target users
- Bloggers and affiliate marketers.
- Small business owners.
- Social media managers.
- Content creators.
- Small agencies managing client Facebook Pages.

## Primary workflow
1. User signs up and creates a workspace.
2. User connects a Facebook account through the official Meta authorization flow.
3. User chooses an eligible Facebook Page.
4. User creates a project from a keyword, URL, or website.
5. LazyAI proposes content pillars, angles, and a posting calendar.
6. User generates one post or a campaign of 30, 60, or 90 items.
7. User reviews, edits, regenerates, approves, or rejects posts.
8. User uploads or selects media.
9. User schedules approved content.
10. Background workers attempt publication at the correct time.
11. LazyAI records the platform result and shows a useful status.
12. User receives an email if a relevant campaign or publishing event needs attention.

---

# 3. Product requirements

## 3.1 Account and workspace
- Supabase Auth for sign-up, sign-in, sign-out, and supported email verification/password reset flows.
- User profile with display name, preferred language, and timezone.
- Default timezone: `Asia/Dhaka`, editable by the user.
- Personal workspace for the MVP.
- Database structure designed to support workspace members later.
- Row Level Security (RLS) on all tenant-owned tables.
- Server-side authorization on every mutating route.

## 3.2 Facebook integration
- Use official Meta OAuth and Graph API only.
- Request minimum necessary permissions.
- Display eligible Pages returned by the authorized API.
- Let the user explicitly select the Page LazyAI may manage.
- Keep access tokens server-side; never expose them to the browser or logs.
- Handle revoked permissions, expired tokens, disconnection, and reconnection.
- Support text and image posts where current API permissions allow.
- Store the provider’s post ID and response.
- Personal Facebook Profile publishing is out of scope.
- Test against a dedicated Page before production.
- Treat Meta app review, business verification, app mode, permission requirements, and production access as external launch dependencies. Verify current official Meta documentation at implementation time.

## 3.3 Input types
- Keyword or topic.
- Single article URL.
- Website homepage.
- Optional sitemap URL or sitemap discovery.
- CSV list of topics (can be implemented after the first URL/topic workflow).
- Language selection: English, Bengali, or both.
- Audience, tone, post format, length, CTA, emoji/hashtag preferences, brand voice, and source-link preference.

## 3.4 Content planning
- Campaign durations: 7, 10, 15, or 30 days.
- Total item count: 30, 60, or 90, independently configurable.
- Generate a proposed calendar before generating all content.
- Suggest content pillars and varied post angles.
- Detect duplicate or near-duplicate ideas.
- Allow regenerating one idea without replacing the whole campaign.
- Validate that requested volume, cadence, daily limits, dates, and time slots are consistent.
- Do not promise that 90 items fit a particular cadence unless the calendar actually has enough slots.

## 3.5 AI post generation
Each content item can include:
- Hook/headline.
- Body text.
- CTA.
- Optional hashtags.
- Source URL.
- Image brief/alt text.
- Language code and content format.
- Optional internal notes or fact-check flags.

Supported initial formats:
- Tip.
- Checklist.
- Question/poll prompt.
- Myth vs. fact.
- How-to.
- Short story or scenario.
- Article summary with original commentary.
- Product/service promotion.
- Educational post.
- Community discussion prompt.

Requirements:
- English and Bengali at launch.
- Write naturally for the target language rather than translating word-for-word.
- Use structured model output validated by Zod.
- Record provider/model, prompt version, token/credit usage, and status.
- Add timeouts and bounded retries.
- If output is invalid, allow one bounded repair attempt; then report a clear error.
- Never fabricate source facts or present uncertain claims as verified.
- Never copy an entire source article by default.
- Let users edit generated content before scheduling.

## 3.6 Images and media
MVP priority:
1. User-uploaded image.
2. Stock image search through one approved provider, after reviewing current API access and license terms.
3. Article Open Graph image when accessible and legally/contractually permitted for reuse.
4. AI image generation as a later optional feature because it adds cost and complexity.

Store:
- Provider or storage path.
- Source URL.
- License/attribution metadata where applicable.
- Alt text.
- MIME type, size, dimensions.
- Workspace owner.
- Processing status.

Security:
- Validate MIME type, extension, file size, and decoded image format.
- Keep private media private unless public delivery is intentionally required.
- Do not blindly hotlink an external image if the social platform requires an uploaded asset.
- Protect URL fetchers against SSRF. Never fetch localhost, private IPs, internal network addresses, or cloud metadata endpoints.
- Validate redirects and re-check destination addresses.

## 3.7 Calendar and scheduler
- Calendar and list views.
- Statuses: `draft`, `awaiting_approval`, `approved`, `scheduled`, `publishing`, `published`, `retrying`, `failed`, `cancelled`.
- Store timestamps in UTC; display in the workspace timezone.
- Batch schedule, cancel, and unschedule.
- Per-Page queue.
- Configurable daily posting limit.
- Prevent accidental scheduling in the past.
- Respect provider rate limits.
- Store attempt count, next retry time, last error, and lock/lease data.
- Use stable idempotency keys to prevent duplicate publishing.
- Retry temporary errors with exponential backoff and jitter.
- Do not endlessly retry permanent errors such as invalid permissions.
- Provide manual retry for eligible failures.
- Provide a workspace-level emergency pause for scheduled publishing.

## 3.8 Email via Resend
Transactional email use cases:
- Welcome/onboarding message.
- Campaign generation completed.
- Publishing failure after retries.
- Facebook connection needs attention.
- Optional weekly usage summary in a later phase.

Requirements:
- Verify a sending domain in Resend.
- Publish the exact SPF, DKIM, and other records Resend instructs you to use.
- Consider a dedicated sending subdomain such as `notify.lazyai.io`.
- Keep `RESEND_API_KEY` server-side only.
- Create an email provider interface so the provider can be replaced later.
- If using Resend as Supabase Auth SMTP, follow the current Supabase and Resend documentation.
- Keep transactional messages separate from marketing email. Provide unsubscribe/preferences for non-essential marketing messages.

## 3.9 Usage and future billing
Billing is not required for the first development batch, but prepare for it.
Track separately:
- Text generation and token/credit use.
- Image search and image generation.
- Content items generated.
- Posts submitted to social platforms.
- Connected Pages/workspaces.
- Storage use.

Enforce limits on the server, not only in the UI. Keep plan limits in configuration/database rather than scattering hard-coded limits throughout components.

---

# 4. Example campaign

Example:
- Topic: `Digital Marketing for Small Businesses`
- Languages: English and Bengali
- Duration: 30 days
- Total content items: 60
- Desired cadence: 2 posts/day
- Preferred slots: 09:00 and 20:00, workspace timezone
- Approval mode: review before scheduling
- Media: uploaded image or approved stock image

Expected flow:
1. Propose a 60-item calendar.
2. Check coverage and repeated angles.
3. Generate posts in small batches to control API costs and failures.
4. Save each item incrementally.
5. Show progress and support cancellation.
6. Require approval before bulk scheduling.
7. Enqueue approved posts.
8. Publish due posts through the worker.
9. Persist confirmed platform results.

Do not generate 90 items in one synchronous request. Use durable jobs and bounded batches.

---

# 5. Recommended technology stack

Use this stack unless the existing repository has a strong, documented reason to choose otherwise.

| Area | Recommendation |
|---|---|
| App | Next.js App Router + TypeScript strict mode |
| UI | Tailwind CSS + accessible component system such as shadcn/ui |
| Validation | Zod |
| Forms | React Hook Form where useful |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Media | Supabase Storage |
| Source control | GitHub |
| Hosting | Vercel |
| Email | Resend |
| AI | Provider-agnostic server-side adapter |
| Social publishing | Meta Graph API adapter |
| URL extraction | Readability/HTML parser with SSRF defenses |
| Queue | Durable PostgreSQL-backed jobs or a proven managed queue |
| Scheduler | Vercel Cron as a dispatcher only if the chosen plan’s timing limits are adequate |
| Tests | Unit, integration, and end-to-end tests |

## 5.1 Background jobs and Cron

Do not perform the entire process of generating 90 posts, searching for images, and publishing them inside a single Vercel request.

Use a durable job table/queue and a dispatcher that claims a small number of jobs. Vercel Cron can trigger the dispatcher, but verify the current plan limits. Vercel Hobby Cron has historically had limited frequency and timing precision; do not assume it provides minute-level scheduling.

If precise minute-level publishing is required, choose an appropriate managed scheduler/worker or queue service after comparing cost and reliability. Keep the queue as the source of truth.

Cron endpoints must:
- Require a strong `CRON_SECRET`.
- Be idempotent.
- Claim jobs atomically.
- Process bounded batches.
- Return without exposing secrets.
- Recover safely after timeouts.

---

# 6. Cloudflare DNS + Vercel + Resend

## Is this combination possible?

**Yes.** Cloudflare can host authoritative DNS while Vercel hosts the application and Resend sends email. Changing nameservers to Cloudflare does not inherently break Vercel or Resend. Incorrect records or incompatible proxy settings can cause problems, so migrate carefully.

## Recommended conservative setup

1. Add `lazyai.io` to Cloudflare.
2. Export or document current DNS records before making changes.
3. Review Cloudflare’s imported records for correctness.
4. At the domain registrar, set the exact nameservers provided by Cloudflare.
5. Wait until Cloudflare shows the zone as active.
6. Add `lazyai.io` and optionally `www.lazyai.io` to the Vercel project.
7. Use the exact DNS targets shown in the Vercel dashboard. Do not guess or copy stale targets from this plan.
8. Initially keep Vercel web records **DNS only** (grey cloud) until Vercel domain verification and production smoke tests succeed.
9. Verify HTTPS, canonical host, redirects, and both apex and `www`.
10. Only consider Cloudflare proxying later, after checking Vercel’s current custom-domain guidance and testing TLS mode, redirects, caching, API routes, and Next.js behavior.
11. Do not cache authenticated dashboard pages, cookies, or dynamic API responses.
12. Add the exact DNS records Resend displays for the chosen sending domain.
13. Keep mail records DNS-only. MX records cannot be proxied, and email-related hostnames should not be orange-cloud proxied.
14. Configure DKIM and SPF exactly as Resend directs. Avoid duplicate SPF TXT records for the same hostname.
15. Add a DMARC TXT record. Start with a monitoring policy such as `p=none`, then tighten after reviewing reports and verifying all legitimate senders.
16. Verify the sending domain in Resend and test messages to multiple mailbox providers.
17. Recheck all DNS records after nameserver migration; changing nameservers does not guarantee all old records were recreated correctly.

### Suggested hostname plan
- `lazyai.io` — canonical application/marketing domain.
- `www.lazyai.io` — redirect to the canonical host.
- `notify.lazyai.io` — optional Resend sending subdomain if recommended by Resend.
- `app.lazyai.io` — optional later separation between marketing and app.

For the MVP, one primary domain is simpler. Do not split the application across subdomains unless there is a clear product reason.

### DNS migration checklist
- [ ] Existing DNS records documented.
- [ ] Cloudflare zone active.
- [ ] Apex record uses the current Vercel-provided value.
- [ ] `www` resolves or redirects as intended.
- [ ] Vercel domain verification passes.
- [ ] TLS certificate is valid.
- [ ] Resend domain verifies successfully.
- [ ] DKIM passes.
- [ ] SPF passes without duplicate records.
- [ ] DMARC record exists and is syntactically valid.
- [ ] Email-related records are DNS-only.
- [ ] Authenticated pages and APIs are not cached.
- [ ] Sign-up, verification, and password reset emails tested.
- [ ] Rollback plan is documented.

### Official documentation to check during setup
- Cloudflare proxy status/use cases: https://developers.cloudflare.com/dns/proxy-status/use-cases/
- Cloudflare DNS records: https://developers.cloudflare.com/dns/manage-dns-records/
- Vercel domains: https://vercel.com/docs/domains
- Vercel Cron: https://vercel.com/docs/cron-jobs
- Resend domain setup: https://resend.com/docs/dashboard/domains/introduction
- Resend SMTP: https://resend.com/docs/send-with-smtp

Provider settings and limits can change. Always use current official dashboard values and instructions.

---

# 7. Architecture overview

```text
Browser / Next.js UI
        |
        v
Next.js server routes / server actions
        |
        +---- Supabase Auth
        +---- PostgreSQL (RLS, migrations, durable jobs)
        +---- Supabase Storage (media)
        +---- AI provider adapter
        +---- Safe website extraction service
        +---- Image search provider adapter
        +---- Meta Graph API adapter
        +---- Resend email adapter

Scheduler / dispatcher
        |
        v
Durable database job queue
        |
        v
Bounded worker batches
        +---- Generate content
        +---- Process media
        +---- Publish due Facebook posts
        +---- Send notifications
        +---- Persist results, retries, and audit events
```

Reliability rules:
- Queue state is the source of truth for background work.
- Use stable job IDs and idempotency keys.
- Claim jobs atomically with locks/leases.
- Use bounded retries and backoff.
- If a publishing request times out after the platform may have accepted it, reconcile before retrying to avoid duplicate posts.
- Consider a transactional outbox pattern when database writes must reliably trigger jobs.
- Log structured, redacted events; never log tokens, API keys, or authorization headers.

---

# 8. Database design

Use committed SQL migrations, foreign keys, indexes, and RLS. Refine names as needed but preserve these concepts.

## `profiles`
- `id` UUID, primary key and FK to `auth.users`
- `display_name`
- `timezone`
- `preferred_language`
- `created_at`, `updated_at`

## `workspaces`
- `id`
- `owner_id`
- `name`
- `timezone`
- `created_at`, `updated_at`

## `workspace_members`
Can be deferred in the first MVP UI, but design for future team access:
- `workspace_id`
- `user_id`
- `role` (`owner`, `admin`, `editor`, `viewer`)
- Unique `(workspace_id, user_id)`

## `social_accounts`
- `id`
- `workspace_id`
- `provider` (`facebook`)
- Provider account identifier where required
- Secure server-only token storage/reference
- Token expiry and last-validation timestamps
- Connection status
- Timestamps

## `social_pages`
- `id`
- `workspace_id`
- `social_account_id`
- Provider Page ID
- Page name
- Permission/capability snapshot
- Connection status
- Timestamps
- Unique provider/Page ID constraint

## `content_projects`
- `id`
- `workspace_id`
- `name`
- `input_type` (`topic`, `url`, `website`, `csv`)
- `input_value`
- Selected languages
- Validated brand/campaign settings JSONB
- Status and timestamps

## `source_documents`
- `id`
- `workspace_id`
- `project_id`
- Source URL and canonical URL
- Title
- Extracted text or safe storage reference
- Retrieval status/time
- Content hash
- Metadata and redacted error
- Respect source terms and reasonable crawl limits.

## `campaigns`
- `id`
- `workspace_id`
- `project_id`
- `name`
- `duration_days`
- `requested_item_count`
- Status
- Language settings
- Approval mode
- Scheduling settings
- Generation progress
- Timestamps

## `content_items`
- `id`
- `workspace_id`
- `campaign_id`
- `project_id`
- Language code
- Content format
- Hook/title
- Body
- CTA
- Hashtags as structured data
- Source URL
- Image brief
- Content hash
- Approval status
- AI provider/model and prompt version
- Usage metadata
- Timestamps

## `media_assets`
- `id`
- `workspace_id`
- Storage path or provider asset ID
- Provider/source URL
- License/attribution metadata
- Alt text
- MIME type, byte size, width, height
- Processing status
- Created timestamp

## `content_item_media`
- `content_item_id`
- `media_asset_id`
- Sort order
- Optional alt-text override

## `scheduled_posts`
- `id`
- `workspace_id`
- `content_item_id`
- `social_page_id`
- Scheduled timestamp in UTC
- Status
- Unique idempotency key
- Provider post ID
- Attempt count and next attempt time
- Redacted last error
- Lock/lease fields
- Published timestamp
- Timestamps

## `job_queue`
- `id`
- `workspace_id` (nullable only for trusted system jobs)
- Job type
- Validated JSONB payload
- Status (`queued`, `processing`, `retrying`, `completed`, `failed`, `cancelled`)
- Priority
- Attempts and max attempts
- `available_at`
- Lock/lease fields
- Idempotency key
- Redacted last error
- Timestamps

## `usage_records`
- `id`
- `workspace_id`
- `user_id`
- Action type
- Provider/model
- Usage units/tokens/credits
- Cost estimate if available
- Related entity IDs
- Created timestamp

## `audit_events`
- `id`
- `workspace_id`
- Actor user ID or system actor
- Action
- Entity type and ID
- Redacted metadata
- Created timestamp

## `email_events`
Optional but recommended:
- `id`
- `workspace_id`
- Recipient reference
- Email template/type
- Provider message ID
- Status and redacted error
- Created timestamp

### RLS requirements
- Enable RLS on every tenant-owned table.
- A user can access only workspaces where they have membership and the required role.
- Browser clients cannot directly change provider tokens, publishing state, usage balances, or job locks.
- Server routes must verify authorization in addition to RLS.
- Never trust a client-supplied `workspace_id` without checking membership.
- Add tests proving cross-workspace reads and writes are denied.

---

# 9. App routes and pages

Suggested route structure; adapt to the repository’s framework conventions.

## Public pages
- `/` — marketing homepage
- `/pricing`
- `/privacy`
- `/terms`
- `/contact`
- `/auth/login`
- `/auth/signup`
- `/auth/callback`

## Authenticated application
- `/app` — dashboard/onboarding
- `/app/projects`
- `/app/projects/new`
- `/app/projects/[projectId]`
- `/app/campaigns`
- `/app/campaigns/[campaignId]`
- `/app/content`
- `/app/content/[contentId]`
- `/app/calendar`
- `/app/social-accounts`
- `/app/media`
- `/app/activity`
- `/app/settings/profile`
- `/app/settings/workspace`
- `/app/settings/notifications`
- `/app/settings/usage`

## Server handlers
- OAuth start/callback/disconnect.
- Content plan and generation.
- Safe URL extraction.
- Media upload and image search.
- Approve/reject content.
- Schedule/unschedule/cancel.
- Authenticated scheduler dispatcher.
- Health check with no sensitive information.
- Resend webhook if required, with signature verification.

Every route must validate input, authenticate the user, authorize workspace access, rate-limit expensive actions, and return typed, non-sensitive errors.

---

# 10. User experience

## Onboarding
1. Welcome screen.
2. Ask preferred language and timezone.
3. Offer Facebook Page connection.
4. Create the first topic or URL project.
5. Generate a small sample.
6. Explain review-before-scheduling defaults.

## Dashboard
Show:
- Connected Pages.
- Drafts awaiting review.
- Scheduled posts.
- Published posts.
- Failed posts needing attention.
- Campaign progress.
- Usage and plan limits.

## Content editor
- Preview a post in a social-style layout.
- Edit body, CTA, hashtags, language, and media.
- Regenerate an item or selected field.
- Display source references for URL-based content.
- Show character count/platform constraints where applicable.
- Duplicate and translate actions.
- Save before scheduling.

## Calendar
- Month/week/list views as feasible.
- Visible timezone.
- Filter by Page, campaign, language, and status.
- Reschedule with validation.
- Show slot conflicts.
- Confirm bulk actions.

## Accessibility and responsive behavior
- Keyboard-accessible controls.
- Visible focus states.
- Semantic labels and accessible dialogs.
- Desktop and mobile layouts.
- Loading, empty, success, and error states.

---

# 11. URL extraction and AI safety

Treat user-supplied URLs and source text as untrusted input.

## URL fetcher protections
- Allow only `http` and `https`.
- Block localhost, private IPs, link-local addresses, internal networks, and cloud metadata endpoints.
- Resolve and validate IPs safely; consider DNS rebinding.
- Revalidate redirect destinations and limit redirect count.
- Enforce connection/read timeouts and response-size limits.
- Accept only expected content types.
- Do not execute remote JavaScript.
- Strip scripts, styles, navigation, and irrelevant boilerplate.
- Respect robots.txt and applicable source terms.
- Limit requests per domain.
- Handle paywalls, login walls, and blocked pages honestly.
- Never bypass access controls.
- Store content hashes to identify unchanged source pages.

## Prompt requirements
- Construct prompts from validated, structured inputs.
- Include topic/source facts, audience, language, brand voice, format, length, CTA, source-link preference, and constraints.
- Ask for structured JSON and validate it.
- Avoid unsupported claims.
- Identify claims that need checking.
- Avoid repeated hooks and angles across a campaign.
- Do not treat instructions embedded in source webpages as system instructions.
- Do not reproduce a full article by default.

## Content quality
- Flag similar posts.
- Check repeated claims and hashtags.
- Permit user edits to override generated suggestions.
- Do not guarantee factual accuracy, reach, or engagement results.

---

# 12. Scheduler state machine

Recommended flow:

`draft → awaiting_approval → approved → scheduled → publishing → published`

Other transitions:
- `draft → rejected`
- `awaiting_approval → draft`
- `approved → cancelled`
- `scheduled → cancelled`
- `publishing → retrying`
- `retrying → publishing`
- `retrying → failed`
- Permanent provider error → `failed`

## Publishing algorithm
1. Verify workspace membership, Page connection, approval status, time, and limits.
2. In a database transaction, create the scheduled-post record and queue/outbox item.
3. Dispatcher claims due jobs atomically.
4. Worker verifies the post is still scheduled and not cancelled.
5. Check connection/permission status and provider rate limits.
6. Submit the post through the provider adapter.
7. Persist provider response and post ID.
8. On confirmed success, mark published and write an audit event.
9. On retryable failure, schedule bounded retry with exponential backoff and jitter.
10. On permanent failure, mark failed and notify the user.
11. If the result is uncertain because of a network timeout, reconcile before retrying to avoid duplicate posts.

---

# 13. Security and privacy checklist

- Store secrets only in environment variables or a managed secret store.
- Never commit `.env` files or production credentials.
- Use `.env.example` with placeholders only.
- Keep service-role keys server-only.
- Validate all input with schemas.
- Rate-limit login, URL extraction, generation, image search, and publishing.
- Verify OAuth state and callback origin.
- Use least-privilege Meta permissions.
- Keep tokens out of browser responses and logs.
- Encrypt tokens at rest where supported by the selected design and tightly limit access.
- Redact provider tokens, authorization headers, and personal data from logs.
- Apply CSRF protections where applicable.
- Validate file type, size, and decoded content.
- Prevent SSRF in all server-side URL fetches.
- Protect worker/cron routes with strong secrets.
- Verify webhook signatures.
- Maintain audit logs for connections, scheduling, publishing, and disconnection.
- Provide account deletion and data export/deletion workflows.
- Define retention for source extracts, media, and logs.
- Add secure headers and review CSP.
- Add dependency and secret scanning.
- Do not claim regulatory compliance without review.

---

# 14. Observability

- Structured logs with request/job IDs.
- Track queue depth, oldest pending job, retries, publish success rate, and provider errors.
- Provide user-visible activity history.
- Provide safe operational queries for stuck jobs.
- Add error tracking after the core app is stable.
- Alert on repeated publishing failures and email delivery failures.
- Never expose stack traces or secrets to end users.

---

# 15. Testing strategy

## Unit tests
- Input schemas.
- Campaign scheduling arithmetic and timezone conversion.
- State transitions.
- Retry policy.
- Idempotency keys.
- Deduplication.
- Usage limit calculations.
- URL safety.

## Integration tests
- Supabase access and RLS.
- Queue claim/lease/recovery.
- AI adapter with mock provider.
- Resend adapter with mock provider.
- Meta adapter with mock provider.
- Media upload and validation.
- OAuth state validation.

## End-to-end tests
- Sign up/sign in.
- Create a topic project.
- Generate sample content using a mock.
- Edit and approve a post.
- Schedule a post.
- Simulate provider success and failure.
- Verify retry does not duplicate posts.
- Verify cross-workspace access is denied.

## Manual pre-production tests
- Connect a test Facebook Page.
- Publish a test text post and image post.
- Test permission errors, token expiry, disconnect/reconnect.
- Test a due post, retry, and permanent failure.
- Test Resend notifications and authentication emails.
- Verify DNS/TLS for apex and `www`.
- Test desktop/mobile usability.

Automated tests must not publish to a real Page or email real customers unless explicitly configured and approved.

---

# 16. Claude development batches

Complete the batches in order. Do not silently skip failed checks.

## Batch 0 — Repository inspection and plan
Tasks:
- Inspect repository, branch, files, dependencies, current app, deployment, and existing tests.
- Preserve existing work; do not overwrite files before understanding them.
- Document whether the repo is empty or an existing project.
- Add/adapt this plan at `docs/LAZYAI_MASTER_PLAN.md`.
- Create `docs/BUILD_PROGRESS.md`.
- Create an architecture decision record for framework and queue approach.
Acceptance:
- No destructive changes.
- Existing state and external dependencies documented.
- Open questions listed.
- Stop and ask if the repository is an unrelated product or has conflicting architecture.

## Batch 1 — App foundation
Tasks:
- Set up Next.js, TypeScript strict mode, Tailwind, accessible UI components, lint/format/test scripts.
- Add responsive shell, public homepage, and placeholder authenticated layout.
- Add `.env.example`, `.gitignore`, README.
- Add GitHub CI for lint, typecheck, tests, and build.
Acceptance:
- Clean install succeeds.
- Lint, typecheck, tests, and production build pass.
- No secrets committed.

## Batch 2 — Supabase and authentication
Tasks:
- Add typed Supabase browser/server clients.
- Add migrations for profiles, workspaces, memberships, and RLS.
- Implement sign-up, sign-in, sign-out, callback, protected routes.
- Add onboarding and timezone preference.
Acceptance:
- Auth works with configured Supabase.
- RLS tenant-isolation tests pass.
- Service-role key remains server-only.

## Batch 3 — Data model and dashboard
Tasks:
- Add migrations for projects, campaigns, content items, media, scheduled posts, queue, usage, audit events.
- Build dashboard, project list/create, content list, calendar skeleton, settings pages.
- Add typed service/repository layer.
Acceptance:
- CRUD works with authorization.
- Loading, empty, error, and success states exist.
- Cross-workspace data is inaccessible.

## Batch 4 — AI adapter and single-post generation
Tasks:
- Create `TextGenerationProvider` interface and one configured implementation.
- Validate structured output with Zod.
- Implement topic-based generation in English and Bengali.
- Add prompt versioning, usage logging, timeouts, bounded retries.
- Add editor and regeneration.
Acceptance:
- User can create and edit one post.
- Missing API key yields a clear configuration error.
- Automated tests use mocks and do not require paid API calls.
- Usage is recorded server-side.

## Batch 5 — URL extraction
Tasks:
- Implement safe URL validation, SSRF defenses, bounded extraction, canonical URL/title detection, and clear error states.
- Extract readable text from one article URL.
- Generate an original post/summary with source link.
- Store source document and content hash.
Acceptance:
- Unsafe/private destinations and redirects are blocked.
- Paywalls/blocked pages return clear errors.
- Source is not blindly copied.
- Tests cover malformed URLs, redirects, oversized responses, and unsafe destinations.

## Batch 6 — Campaign planner and bulk generation
Tasks:
- Add topic/URL, language, duration, item count, tone, and posting preferences.
- Generate a proposed calendar.
- Generate content through small queue batches.
- Show progress; support cancellation and retry.
- Add duplicate/near-duplicate checks.
Acceptance:
- 30/60/90 items do not run in one synchronous request.
- Partial failures do not lose successful items.
- Campaign count and dates are validated.
- English and Bengali work through mock tests and manual provider tests.

## Batch 7 — Media and images
Tasks:
- Add secure user uploads to Supabase Storage.
- Add media library and image attachment.
- Add one stock provider behind `ImageSearchProvider` only after reviewing API access and licensing.
- Preserve source/license metadata.
Acceptance:
- Invalid/oversized files rejected.
- Private media is not public by accident.
- Attribution metadata is retained.
- API keys stay server-side.

## Batch 8 — Meta OAuth and Facebook Pages
Tasks:
- Implement OAuth with state verification and secure callback.
- Add Page selection, connection status, supported token handling, reconnect, and disconnect.
- Create `SocialPublishingProvider` interface and Meta adapter.
- Support post types allowed by current official API permissions.
- Add mock mode.
Acceptance:
- Mock integration tests pass.
- Tokens never appear in browser responses or logs.
- Permission errors give actionable guidance.
- Live tests require a user-approved test Page.
- Production availability is documented as dependent on Meta configuration and approvals.

## Batch 9 — Durable scheduler and publishing
Tasks:
- Add atomic queue claiming, leases/locks, idempotency, due-job dispatch, retry/backoff, permanent failures, and uncertain-result reconciliation.
- Add schedule/unschedule/cancel.
- Add `CRON_SECRET`-protected dispatcher.
- Use Vercel Cron only if the chosen plan’s timing precision is sufficient; document alternatives otherwise.
- Add calendar status and retry controls.
Acceptance:
- Repeated worker invocation does not duplicate posts.
- Cancelled posts are not published.
- Temporary and permanent errors are handled differently.
- Timezone conversions are tested.
- Unauthenticated cron requests are rejected.
- Worker batches respect execution limits.

## Batch 10 — Resend and email
Tasks:
- Add Resend adapter and templates for onboarding, campaign completion, publishing failure, and reconnect notices.
- Configure Supabase Auth SMTP through Resend if selected and supported.
- Add email preferences and delivery event logging.
- Document DNS records using exact values shown by Resend.
Acceptance:
- Tests use mocks.
- Missing key shows a configuration error.
- Email failures do not break publishing.
- No secrets exposed.
- DNS instructions are documented; code does not change production DNS.

## Batch 11 — Usage limits and hardening
Tasks:
- Add server-side usage enforcement and configurable plans.
- Rate-limit expensive routes.
- Add activity/audit history.
- Add account deletion/export workflow and privacy/terms pages.
- Add security headers, dependency scanning, secret scanning.
Acceptance:
- Limits cannot be bypassed through direct API calls.
- Deletion behavior tested/documented.
- Logs are redacted.
- Critical security tests pass.

## Batch 12 — Deployment and DNS runbook
Tasks:
- Prepare Vercel configuration and environment variable checklist.
- Document Supabase migrations and environment separation.
- Document GitHub preview/production workflow.
- Document Cloudflare nameserver migration, Vercel domain verification, and Resend authentication.
- Start with Vercel web records set to DNS-only; consider proxy only after validation.
- Add smoke tests and rollback steps.
Acceptance:
- Preview deployment works.
- Production steps are explicit and reversible.
- Apex and `www` verified.
- TLS and Resend sending domain verified.
- No secrets in repo/logs.

## Batch 13 — Release readiness
Tasks:
- Run all checks and end-to-end tests.
- Complete test-Page publishing flow.
- Verify status labels and failure messages.
- Review mobile responsiveness and accessibility.
- Write user help docs and incident/rollback notes.
- Produce release checklist and known limitations.
Acceptance:
- Critical tests pass.
- No unresolved critical security issue.
- Provider approval limitations documented.
- User explicitly approves production launch.

---

# 17. Claude working rules

Claude must:
1. Inspect the repository before writing code.
2. Work on one batch at a time.
3. Before each batch, state the objective and expected files to change.
4. Prefer small, reviewable changes over huge rewrites.
5. Reuse existing code where correct.
6. Never delete/replace user files without inspecting their purpose.
7. Never invent API keys, account IDs, OAuth secrets, DNS targets, provider IDs, or approval status.
8. Use placeholders in `.env.example`.
9. Never send real customer emails, perform live publishing, change production DNS, delete production data, or incur significant paid API costs without explicit approval.
10. Run lint, typecheck, relevant tests, and build after each batch when feasible.
11. Fix failures introduced by the current batch before continuing.
12. Update `docs/BUILD_PROGRESS.md` at the end of every batch.
13. If a credential is missing, build a mockable interface and continue unrelated work; mark integration as not live.
14. If interrupted by context/session limits, leave a precise handoff note and resume from the progress file.
15. Ask only for real decisions, credentials, or external approvals; do not ask for facts already in the repo or this plan.
16. Never claim a feature is complete unless code, tests, and configuration support the claim.
17. Do not proceed if the current batch has failing critical checks.

### Required progress-log format
For each batch, record:
- Status: `NOT STARTED`, `IN PROGRESS`, `BLOCKED`, or `DONE`.
- Objective.
- Files changed.
- Database migrations.
- Tests/checks and results.
- External setup still required.
- Decisions made.
- Known issues.
- Exact next action.

---

# 18. Environment variables

Create `.env.example` with placeholder names only. Adapt names to the selected libraries and current documentation.

```bash
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Supabase public/browser config
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only Supabase secret; never expose in browser
SUPABASE_SERVICE_ROLE_KEY=

# AI provider
AI_PROVIDER=
AI_API_KEY=
AI_TEXT_MODEL=

# Meta OAuth / Graph API
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=
META_GRAPH_API_VERSION=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Scheduler
CRON_SECRET=
JOB_WORKER_BATCH_SIZE=

# Optional image provider
IMAGE_PROVIDER=
IMAGE_PROVIDER_API_KEY=

# Optional error monitoring
ERROR_TRACKING_DSN=
```

Rules:
- Check current Supabase library conventions before finalizing names.
- `NEXT_PUBLIC_` variables are public by design; never put secrets in them.
- Validate required variables at startup or when a feature is used.
- Never commit `.env.local` or real credentials.
- Use separate credentials for development, preview, and production.

---

# 19. Definition of MVP complete

A controlled beta is ready only when a test user can:
1. Sign up and log in.
2. Create a workspace and set a timezone.
3. Create a topic project and an article-URL project.
4. Generate original English and Bengali posts.
5. Generate a campaign without one long synchronous request.
6. Review and edit content.
7. Upload or select an allowed image.
8. Connect a configured test Facebook Page.
9. Schedule a post through LazyAI.
10. See a post published after its due time with a confirmed provider result.
11. Recover from retryable errors without duplicate posts.
12. Receive a transactional email for a relevant failure/completion event.
13. View usage and activity history.
14. Be prevented from accessing another workspace’s data.
15. Use the application over valid HTTPS with verified DNS and no exposed secrets.

---

# 20. Decisions to resolve during implementation

Claude should investigate and document options but must not silently commit to expensive or irreversible choices:
- Which AI provider/model best balances English/Bengali quality, cost, and latency.
- Which stock-image provider offers appropriate API access and license terms.
- Whether Vercel Cron is sufficient or a dedicated scheduler/worker is needed.
- Current Meta Graph API version, permissions, and review requirements.
- Whether to add billing after beta and which provider is suitable.
- Whether marketing and app pages remain on `lazyai.io` or later move to `app.lazyai.io`.

Record decisions in `docs/decisions/` with date, context, options, decision, and consequences.

---

# 21. Official documentation

Claude must check current official documentation before implementing integrations because APIs, permissions, pricing, and plan limits can change.

- Next.js: https://nextjs.org/docs
- Supabase: https://supabase.com/docs
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Vercel domains: https://vercel.com/docs/domains
- Vercel Cron: https://vercel.com/docs/cron-jobs
- Vercel limits: https://vercel.com/docs/limits
- Cloudflare DNS proxy use cases: https://developers.cloudflare.com/dns/proxy-status/use-cases/
- Cloudflare DNS records: https://developers.cloudflare.com/dns/manage-dns-records/
- Resend domain setup: https://resend.com/docs/dashboard/domains/introduction
- Resend SMTP: https://resend.com/docs/send-with-smtp
- Meta developer documentation: https://developers.facebook.com/docs/
- Meta Graph API: https://developers.facebook.com/docs/graph-api/

---

# 22. First instruction

Start with **Batch 0 only**. Inspect the repository and document the current state. Do not attempt to build the whole product in one pass.

If the repository is empty, document the proposed architecture and then begin Batch 1 after the inspection. If it contains an existing product, preserve its current behavior and integrate LazyAI incrementally. Update `docs/BUILD_PROGRESS.md` after each batch, report checks honestly, and pause for approval before external account actions, DNS changes, Meta production approval, live publishing, real customer email, or other irreversible actions.

---

# 23. Owner constraints and workflow notes (added 2026-10-20)

These were provided by the project owner after the original plan was written and apply to every batch.

## 23.1 GitHub upload method: browser drag and drop (100-file limit)
- All code reaches GitHub through the **browser drag-and-drop uploader**. There is no local git/CLI workflow.
- That uploader accepts **at most 100 files per upload** (and 25 MB per file). Claude must therefore:
  1. Deliver every batch as a zip containing **fewer than 100 files**; if a batch needs more, split it into `partN` zips of under 100 files each, in upload order.
  2. Include in each zip every file from earlier batches that has **changed** and must be re-uploaded (not the whole repo each time).
  3. List files that were **deleted or renamed**, since drag-and-drop cannot delete; the owner removes them manually on GitHub.
  4. Keep hidden files (`.github/`, `.gitignore`, `.env.example`) easy to find and mention them in the upload notes.
  5. Avoid unnecessary file sprawl (many tiny files, generated assets, committed build output).
  6. Never ask the owner to run git commands.
- A `package-lock.json` cannot be generated in the build sandbox (no network) and cannot easily be produced without a local Node install; CI and Vercel use `npm install` until a lockfile exists. Revisit once the owner can generate one (for example via a GitHub Actions run that commits it, or a local `npm install`).

## 23.2 Free tiers until commercial launch
- Vercel **Hobby**, and the free plans of Supabase, Resend, GitHub, and any other service, are used during development. Move to paid plans (Vercel Pro etc.) **before** commercial launch. Vercel Hobby is for non-commercial use.
- Design for the limits, and verify current official limits at implementation time:
  - **Vercel Hobby Cron** has historically been limited (roughly daily, imprecise timing). Do **not** assume minute-level publishing during development. Batch 9 must pick a dispatcher that works within the free tier for testing and document what changes at Pro.
  - **Supabase free projects** may pause after inactivity and have storage/database/bandwidth caps.
  - **Resend free tier** has daily/monthly sending caps and a limited number of domains.
  - AI provider usage is paid per use; keep generation batches small and use mocks in tests.
- Record the free-to-paid upgrade checklist in `docs/` before Batch 13.

## 23.3 Brand and design direction
- Use the supplied LazyAI logo everywhere for now. Source: `docs/brand/LogoLogo.source.png` (has a baked-in fake checkerboard background). Cleaned transparent versions live in `public/brand/` (`logo.png` for light backgrounds, `logo-light.png` for dark backgrounds); the app icon and social card are generated from it.
- Brand colours: ink `#0E1722`, blue `#006FFE`.
- **Frontend and backend/dashboard design must be simple and lucrative** (clean, uncluttered, conversion-focused): one clear primary action per screen, generous whitespace, honest copy, fast, mobile-friendly, accessible. Pay special attention to design in every batch that touches UI.
