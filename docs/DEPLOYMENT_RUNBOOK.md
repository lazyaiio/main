# Deployment and domain runbook

Plain steps for running LazyAI on a real domain. Nothing here changes by itself: you do each step, and the steps marked **STOP AND CONFIRM** must not be done until you have decided on purpose. The page **Admin -> Deployment** checks most of this for you and shows the exact addresses to copy.

## 1. How the pieces fit

| Piece | Job |
|---|---|
| GitHub (`main` branch) | Holds the code. Every upload to `main` becomes a **Production** deploy on Vercel. Every other branch or pull request becomes a **Preview**. |
| Vercel | Builds and hosts the site. Holds all keys as environment variables. |
| Supabase | Database, sign-in, file storage, and the scheduler clock. |
| Resend | Sends email. Needs your domain's DNS records to be trusted. |
| Meta (Facebook) | Page connection and posting. Knows your site's addresses. |
| Cloudflare (or your registrar) | Holds the domain's DNS. |

Rule of thumb: **Production is the only place with real customers and real Facebook posting.** Previews are for looking at a change before it goes live.

## 2. Environments and variables

In Vercel -> Project -> Settings -> Environment Variables, each variable has three checkboxes: Production, Preview, Development. Use these settings:

| Variable | Production | Preview | Note |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | your real address, for example `https://your-domain.com` | **leave unset** | Previews then use their own address. No trailing slash. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | yes | yes (same project while developing) | Use a separate Supabase project for Production before launch (section 6). |
| AI keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`) | at least one | optional | Previews can skip them to avoid spending. |
| `META_APP_ID`, `META_APP_SECRET`, `TOKEN_ENCRYPTION_KEY` | yes | optional | Never change `TOKEN_ENCRYPTION_KEY` after Pages are connected, or every Page must be reconnected. Keep a safe copy outside Vercel. |
| `CRON_SECRET` | yes | optional | At least 16 characters. Must equal the value inside the Supabase cron job. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET` | yes | optional | Sender must be on your verified domain. |
| `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_OPERATOR_COUNTRY` | yes | yes | Shown on the Privacy Policy and Terms. |
| `AI_MOCK`, `META_MOCK` | **remove** | optional | Ignored in production anyway. |
| `LIVE_PUBLISHING_ENABLED` | leave unset (or `0` as an emergency stop) | unset | `0` forces real posting off, whatever the Admin switch says. |

Changing a variable does nothing until you **redeploy** (Vercel -> Deployments -> the latest -> menu -> Redeploy).

## 3. Putting your domain on the site

**STOP AND CONFIRM before step 3.2.** Changing nameservers or DNS records affects your live address.

1. **Buy or choose the domain.** Decide the main address: `your-domain.com` (recommended) or `www.your-domain.com`. Pick one; the other will redirect to it.
2. **Add it in Vercel:** Project -> Settings -> Domains -> Add. Add both `your-domain.com` and `www.your-domain.com`, and set one to redirect to the other. Vercel then shows the exact DNS records it wants. Use exactly what Vercel shows. Do not copy addresses from old guides.
3. **Add the records at your DNS provider** (Cloudflare: DNS -> Records). In Cloudflare, set the Vercel records to **DNS only** (grey cloud) so Vercel can issue the certificate.
4. **Wait** (minutes to a few hours). Vercel's Domains page turns green and shows "Valid Configuration".
5. **Set `NEXT_PUBLIC_APP_URL`** (Production only) to the address from step 1, then redeploy.
6. **Update the other services** (section 4). Open Admin -> Deployment: the list "Addresses to register elsewhere" has every value, ready to copy.
7. **Smoke test** (section 5).

## 4. After the domain changes: update every service

| Where | What to change |
|---|---|
| Supabase -> Authentication -> URL Configuration | Site URL = your address. Add `https://your-domain.com/**` to Redirect URLs. For previews also add your Vercel preview pattern shown in Vercel (a `*.vercel.app` address with `/**`). |
| Supabase SQL cron job (see `docs/SCHEDULER_SETUP.md`) | The job calls `<address>/api/cron/dispatch`. Run `select cron.unschedule('lazyai-dispatch');` first, then run the setup SQL again with the new address and the same secret as `CRON_SECRET`. |
| Meta app -> Facebook Login -> Settings | Valid OAuth Redirect URI, Deauthorize callback URL. |
| Meta app -> App settings -> Basic | App domain, Privacy Policy URL, Terms URL, Data deletion request URL. |
| Resend -> Webhooks | Endpoint `<address>/api/email/webhook`. |
| Resend -> Domains | Your domain verified (section 5.2) and `RESEND_FROM_EMAIL` on it. |

Test after: sign in with a new email link, connect a Page (Meta), send a test email from Admin -> Email.

## 5. Email on your own domain (Resend)

1. Resend -> Domains -> Add your domain. Resend shows several DNS records (SPF, DKIM, and optionally a return path).
2. Add them at your DNS provider exactly as shown, as **DNS only** records. Click Verify in Resend.
3. Add a DMARC record so mailbox providers trust you. A safe starting record is a TXT record named `_dmarc` with value `v=DMARC1; p=none; rua=mailto:you@your-domain.com`. Watch the reports for a few weeks before making it stricter.
4. Set `RESEND_FROM_EMAIL` to something like `LazyAI <notifications@your-domain.com>`, redeploy, and send a test from Admin -> Email.

## 6. Smoke test after each production deploy

Open Admin -> Deployment (it lists the pages) and check:

1. Every row is green or intentionally "not in use".
2. Home page, `/pricing`, `/privacy`, `/terms`, `/data-deletion` load.
3. `/api/health` says ok.
4. `/robots.txt` and `/sitemap.xml` show your real domain, not the Vercel address.
5. Log in, open the dashboard, open Settings.
6. Connect or open a Facebook Page screen (no posting needed).
7. Admin -> Publishing: the heartbeat is recent and live posting is in the state you intend.

## 7. Roll back a bad deploy

**Fast way (use this first):** Vercel -> Deployments -> find the last good Production deploy (green, before the bad one) -> menu -> **Promote to Production**. This takes seconds and does not touch GitHub. Remember it: the next upload to `main` deploys again, so fix the code before uploading.

**Code way:** on GitHub, open the bad commit -> **Revert**. Merge the revert pull request. Vercel redeploys the old code.

**Database:** migrations are not undone by a code rollback. They are written to be re-runnable and additive. If a migration itself is the problem, stop and ask for a fix script; do not delete tables by hand.

**Posting emergency:** Admin -> Publishing -> turn live publishing OFF. Or set `LIVE_PUBLISHING_ENABLED=0` in Vercel and redeploy.

## 8. Dependabot pull requests (the "Bump ..." deploys in Vercel)

Dependabot is a GitHub helper that proposes package updates as pull requests. Each one gets a **Preview** deploy on Vercel. They do **not** change your live site until you merge one.

- A red Preview on a "Bump ..." branch is **not** a problem with your live site. It only means that update does not work with the current code.
- **Major version jumps** (the first number changes, for example Tailwind 3 to 4, TypeScript 5 to 7, Zod 3 to 4, tailwind-merge 2 to 3) need code changes. Close those pull requests ("Close pull request" button, no merge). The configuration in `.github/dependabot.yml` no longer proposes them.
- **Minor and patch groups** are usually safe. Merge one only if **both** are green: the Vercel Preview and the GitHub Actions checks on the pull request (open the pull request and scroll to the checks box). Merge one at a time.
- A green Vercel Preview alone is not enough: Vercel builds the site but does not run the tests.
- Some pairs must move together. `tailwind-merge` 3 only works with Tailwind 4, so never merge it alone. Plan major upgrades as their own batch.

## 9. Backups before launch

Supabase free projects do not include automatic downloadable backups you can rely on. Before real customers, upgrade the Supabase project (the paid plan includes daily backups) and see `docs/GO_LIVE_UPGRADE_CHECKLIST.md`.
