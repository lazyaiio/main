# ADR 0010: Support inbox, announcement banner, maintenance mode

Status: accepted (Batch 20)

## Decisions
- **Support messages live in their own table that browsers can never touch** (row security on, no policies, no grants). Only server code with the service key reads or writes it. Reason: messages contain personal data from people who may not have an account.
- **Spam control without a captcha:** hidden box, minimum fill time, link count, and database-side limits (`support_can_submit`). A bot gets the same thank-you as a person so it learns nothing. No third-party scripts are added.
- **No raw IP address is stored.** The same daily one-way label idea as the analytics is used, and only for rate limiting.
- **Replies are sent only by an admin action**, one email per press, with an idempotency key so a double click cannot send two. They are not written to `email_events` (that table is for account notifications and has a fixed list of templates).
- **Banner and maintenance settings are one JSON value in `platform_settings`** (key `site_notice`), read through a 30-second cache. No new table. All text is validated: English only, plain text, links only to this site or `https://`.
- **Maintenance mode is a courtesy screen, not a security boundary.** Middleware cannot read the database, and server actions can still be called directly. Admins are always let in so the switch can be turned off. The scheduler is never paused.

## Not done on purpose
- No automatic acknowledgement email to people who write (it would be a real email sent without a person deciding).
- No attachments in the contact form.
- No threads: a second message from the same person is a new message.
