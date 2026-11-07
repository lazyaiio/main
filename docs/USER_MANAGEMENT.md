# People, plan emails, and settings export (Batch 21)

## 1. One-time setup

1. Supabase SQL Editor: run `supabase/migrations/0024_user_management.sql`, then `supabase/tests/rls_user_management.sql`.
   Expected last line: `ALL USER MANAGEMENT TESTS PASSED`. The test uses fake rows inside a transaction and rolls back.
2. Upload the Batch 21 files to GitHub. Wait for GitHub Actions and Vercel to go green.
3. The emails need Resend (see `docs/EMAIL_SETUP.md`) and the scheduler running every minute (see `docs/SCHEDULER_SETUP.md`). Without Resend nothing breaks: the emails are simply skipped and the delivery log says `not_configured`.
4. `SUPABASE_SERVICE_ROLE_KEY` must be set in Vercel (it already is if the scheduler and payments work). Suspending also uses it to block sign-in at Supabase.

## 2. Admin -> People

- Search by email or name (25 per page, newest first). Each row shows the plan, whether the email is verified, whether the account is suspended, when the person joined and last signed in.
- **Change plan** (press "Manage" on a row): choose the plan and how it is held.
  - *No end date*: stays until you change it again.
  - *Monthly / Yearly*: you choose the end date (UTC, end of that day). When it passes, the scheduler moves the workspace to Free and emails the owner.
  - *Lifetime*: never ends.
  - *Free*: ignores the other two fields.
  The change applies at once. It does not create a payment and sends no email.
- **Suspend:** the person cannot sign in (Supabase blocks it) and cannot create or change anything (the database blocks it). Their content is kept. The reason is only visible to admins. You cannot suspend yourself or another platform admin.
- **Restore:** lifts both blocks. If Supabase cannot be reached nothing changes and you can press Restore again.

## 3. Payment and plan emails

| Email | When | Sent to |
|---|---|---|
| Receipt | Right after a bKash payment is confirmed and applied | The person who paid |
| Plan ending soon | Once per end date, when a monthly or yearly plan ends within 7 days (checked 04:00 to 04:09 UTC) | The workspace owner |
| Plan ended | When the scheduler moves the workspace back to Free | The workspace owner |

- The delivery log (`email_events`) stops a second copy of the same email. A renewal changes the end date, so the next ending gets its own email.
- These are service messages and have no opt-out switch. Nothing is charged automatically.
- Receipts are not sent for payments made before this batch.
- Plans an admin set by hand without an end date, and lifetime plans, never get an "ending" email.

## 4. Admin -> Backup (settings export)

A JSON file with plans, site currency, SEO and notice settings, analytics settings, the editable pages, page-by-page SEO, and the blog (categories and every article, drafts included).
It never contains bKash credentials, AI provider keys, stock photo keys, email keys, people, posts, payments, media files, or support messages.
There is no restore button yet. It is a copy for safekeeping, not a database backup (use Supabase backups for that).

## 5. Quick test (15 minutes)

1. Admin -> People: search for your own email. You should see your row. Search `%`: nobody should match.
2. With a throwaway test account (not your admin account): press Manage -> change the plan to a paid plan, "Monthly", ending tomorrow. Check the new plan shows in the row, and on that account's Billing page.
3. Suspend the throwaway account with a reason. In a private window try to sign in as it: sign-in must be refused. Restore it, and sign in again.
4. Try to suspend your own row: it must be refused.
5. Admin -> Backup -> Download settings. Open the file in a text editor and search it for `appKey`, `secret`, `password`: nothing should be found.
6. Email (needs Resend and live bKash or sandbox): complete one sandbox payment as a test account and check its inbox (and spam) for the receipt.
7. To see the "ending soon" and "ended" emails: set the throwaway account's plan to Monthly ending in 3 days, then wait for 04:00 UTC. Setting an end date in the past is refused, so the "ended" email is seen only after a real end date passes.
