# Support inbox, announcement banner, maintenance mode (Batch 20)

## 1. One-time setup

1. Supabase SQL Editor: run `supabase/migrations/0023_support_inbox.sql`, then `supabase/tests/rls_support.sql`.
   Expected last line: `ALL SUPPORT TESTS PASSED`. The test uses fake rows inside a transaction and rolls back.
2. Upload the Batch 20 files to GitHub. Wait for GitHub Actions and Vercel to go green.
3. Email replies need Resend (see `docs/EMAIL_SETUP.md`). Without it the inbox still works, only "Send reply" says email is not set up.
4. `TOKEN_ENCRYPTION_KEY` should be set (it already is if Facebook connections work). It is used to make a daily one-way label for spam limits. Without it, only the "3 messages per email address per day" limit applies.

## 2. Support inbox

- Public form: `/contact` (below the page text you edit in Admin -> Pages).
- Admin -> **Support**: filter New / In progress / Closed / All, open a message, reply by email, write a private note, change status. The number of new messages shows next to "Support" in the menu.
- A reply is a **real email to a real person**. It is sent only when you press "Send reply". Nothing is sent automatically (no auto-acknowledgement).
- Spam guards: a hidden box bots fill in, a minimum of about 2.5 seconds on the form, more than 3 links is refused, at most 5 messages per hour from one visitor label, at most 3 per day per email address. A suspected bot sees the normal thank-you message and nothing is saved.
- Privacy: the visitor's IP address is never stored (only a one-way label that changes every day). Closed messages are deleted after 365 days by the daily scheduler run (03:05 UTC).
- People may write in Bengali. Only the site's own text must be English.

## 3. Announcement banner

Admin -> **Notices**. Text (up to 160 characters, English, plain text), a color, and an optional link (a page like `/pricing` or an `https://` address). Visitors can close it for their browser session; it returns when you change the text. It shows on the public pages and inside the app.

## 4. Maintenance mode

Admin -> **Notices** -> Maintenance mode.

- On: signed-in customers see a short "We will be right back" page instead of the app. Platform admins still see everything and a yellow strip that says maintenance is on.
- Not affected: the public website, the sign-in pages, the scheduler (posts already scheduled still publish), and `/admin`.
- This is a courtesy screen, **not a security lock**. It hides the app pages; it does not block someone who calls the app's internal endpoints directly. For a real shutdown, use Vercel (pause the deployment) instead.

## 5. Quick test (10 minutes)

1. Open `/contact` in a private window. Send a message with your own email. You should see "Message sent".
2. Admin -> Support: the message is New. Open it, write a reply, press Send reply, and check your inbox (and spam).
3. Admin -> Notices: turn the banner on with the text "Test banner". Open the home page: the banner shows. Close it, reload: it stays closed. Change the text: it shows again. Turn it off.
4. Turn Maintenance mode on. Open `/app` in a window signed in as a normal customer (not an admin): you see the maintenance page. As an admin you still get in. Turn it off again.
