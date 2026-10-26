# Email setup (Resend)

LazyAI sends a few notification emails (welcome, campaign finished, post not published, Facebook Page needs attention). Sign-in emails (confirm your address, reset password) are sent by Supabase; this guide also points those at Resend so they come from your own domain.

You do not need email to use LazyAI. Without these settings the notifications are skipped (and logged as "email not set up"); nothing else breaks.

## What the code does and does not do
- It never changes DNS. You add the records yourself, copying them exactly from Resend.
- Email problems can never break publishing, campaigns, or sign-up: sending runs after the page has answered and failures are only logged.
- The delivery log (Admin -> Email) stores the type of email, its status, and a short error code. It never stores email addresses, message text, or keys.
- The same notice is never sent twice (each has a unique key), and Resend also gets an idempotency key.
- A bounce or a spam complaint pauses further emails to that person (shown in their Settings).

## Steps
1. **Create a Resend account** at https://resend.com (free plan is fine to start).
2. **Add your sending domain:** Resend -> Domains -> Add Domain. A subdomain such as `mail.yourdomain.com` keeps it separate from your normal email. Resend then shows a list of DNS records (SPF, DKIM, and others).
3. **Add those records at your DNS host** (where you bought the domain), copying each name, type, and value exactly. Back in Resend press **Verify**. This can take from a few minutes to a day. Recommended extra: a DMARC record at `_dmarc.yourdomain.com`, type TXT, value `v=DMARC1; p=none; rua=mailto:you@yourdomain.com`.
4. **Create an API key:** Resend -> API Keys -> Create, permission **Sending access**, limited to your domain. Copy it once.
5. **Vercel -> Settings -> Environment Variables**, add (Production), then **Redeploy**:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | the API key |
| `RESEND_FROM_EMAIL` | for example `LazyAI <notifications@mail.yourdomain.com>` (the domain must be the verified one) |
| `RESEND_WEBHOOK_SECRET` | from step 6 |

6. **Delivery reports (webhook):** Resend -> Webhooks -> Add Endpoint. URL: `https://YOUR-DOMAIN/api/email/webhook`. Events: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`. Copy the **Signing Secret** (starts with `whsec_`) into `RESEND_WEBHOOK_SECRET` and redeploy. Requests without a valid signature (or older than 5 minutes) are refused.
7. **Check it:** Admin -> Email shows green checks. Press **Send a test email to me**. Then look at "Recent emails": the status moves from `sent` to `delivered` once the webhook works.
8. **Sign-in emails from your domain (optional but recommended):** Supabase -> Project Settings -> Authentication -> SMTP Settings -> enable custom SMTP: host `smtp.resend.com`, port `465`, username `resend`, password = the same API key, sender email = an address on your verified domain, sender name `LazyAI`. Save, then sign up with a test address to see the confirmation email arrive. (Supabase's built-in email is limited to a few messages per hour and is only meant for testing.)

## Troubleshooting
| What you see | Fix |
|---|---|
| Admin -> Email says "Missing in your hosting settings" | Add the named variable in Vercel and redeploy. |
| Test email: "The email service rejected the request" | The API key is wrong, or the sender domain is not verified yet. Check Resend -> Domains. |
| Status stays `sent` and never `delivered` | The webhook is not set up or the signing secret does not match. |
| A person gets no emails | Their Settings may have the notice turned off, or the address was paused after a bounce. Admin -> Email "Recent emails" shows `skipped` with the reason. |
