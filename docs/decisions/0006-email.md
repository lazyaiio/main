# ADR 0006: Notification email through Resend

Status: accepted (Batch 10)

## Decision
- **Provider:** Resend over its HTTPS API (plain `fetch`, no SDK), behind small pure functions so it can be tested with a fake network. Errors become four plain kinds (rejected, rate limited, temporary, invalid); the key never appears in a message.
- **What is sent:** welcome (once, after onboarding), campaign finished, post not published (owners and admins), Facebook Page needs attention (owners and admins, at most once a day per problem). Sign-in emails stay with Supabase Auth, which is pointed at Resend's SMTP so they come from the owner's domain (documented, set in the Supabase dashboard).
- **Never breaks the product:** every send runs after the response (`after`) and swallows its own errors. Missing configuration means "skipped", recorded once in the log.
- **No duplicates:** every notice has a unique `dedupe_key` in `email_events`, plus an idempotency key at Resend.
- **Preferences:** three on/off choices per person (own row only). `suppressed` is set only by the server after a bounce or spam complaint and stops all notification emails to that person.
- **Delivery log:** `email_events` holds template, status, provider message id, and an error code, with no addresses or text. Browsers cannot read or write it; platform admins can read it (Admin -> Email). A signed Svix webhook (`/api/email/webhook`, replay window 5 minutes) updates statuses and never lets earlier news overwrite later news.
- **Templates:** plain, accessible HTML plus a text version, American English, every value escaped, subjects forced to one line (no header injection), a Settings link and a List-Unsubscribe header on optional notices.
- **DNS:** never touched by code. `docs/EMAIL_SETUP.md` walks through it.

## Consequences
- Email needs three settings in Vercel; without them notifications are skipped.
- Notifications about a person's own actions (such as disconnecting a Page) are intentionally not emailed.
