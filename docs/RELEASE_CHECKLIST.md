# Release checklist

Go through this list top to bottom. A launch needs every item in sections 1 to 4 done and **your explicit written approval** at the end. Nothing in this list is done for you, and no step turns on real posting or takes payment by itself.

## 1. Automated checks (all must be green)

- [ ] GitHub Actions on `main`: install, lint, typecheck, tests, and build all pass.
- [ ] Vercel: the latest Production deployment says Ready.
- [ ] No open Dependabot pull request for a major version (the config no longer creates them). Minor and patch pull requests are merged only when both Actions and the Vercel Preview are green.
- [ ] Admin -> Deployment: no red row, and every yellow row is understood.
- [ ] Every SQL test below was run in the Supabase SQL Editor after its migration and printed its final line. Run them against the **production** project if it is separate from your test project.

| SQL test file | Final line expected |
|---|---|
| `rls_tenant_isolation.sql` | `ALL RLS TESTS PASSED` |
| `rls_core_tables.sql` | `ALL CORE RLS TESTS PASSED` |
| `rls_admin_ai.sql` | `ALL ADMIN/AI TESTS PASSED` |
| `rls_sources.sql` | `ALL SOURCE TESTS PASSED` |
| `rls_campaign_planner.sql` | `ALL CAMPAIGN PLANNER TESTS PASSED` |
| `rls_media.sql` | `ALL MEDIA TESTS PASSED` |
| `rls_media_thumbnails.sql` | `ALL THUMBNAIL TESTS PASSED` |
| `rls_social.sql` | `ALL SOCIAL TESTS PASSED` |
| `rls_data_deletion.sql` | `ALL DATA DELETION TESTS PASSED` |
| `rls_scheduling.sql` | `ALL SCHEDULING TESTS PASSED` |
| `rls_platform_settings.sql` | `ALL PLATFORM SETTINGS TESTS PASSED` |
| `rls_email.sql` | `ALL EMAIL TESTS PASSED` |
| `rls_plans_limits.sql` | `ALL PLANS AND LIMITS TESTS PASSED` |
| `rls_account_deletion.sql` | `ALL ACCOUNT DELETION TESTS PASSED` |

## 2. End-to-end walk-through (about 30 minutes, on the live address)

Use a brand-new email address so you see what a customer sees. Write down anything confusing, even if it works.

1. Sign up, confirm the email, finish setup. Expected: you land on the dashboard.
2. Create a project. Expected: it appears in Projects.
3. Generate one post in English and one in Bengali. Expected: both appear in Content as drafts. (Bengali text is allowed in the posts you generate. It is never part of the site itself.)
4. Edit a post, choose Submit for review, then Approve. Expected: the status changes each time.
5. Create a small campaign (3 posts). Expected: progress shows, then "Ready to review".
6. Upload an image and attach it to a post. Expected: a thumbnail shows.
7. Settings: change the email preferences, download your data. Expected: a file downloads.
8. Pages: with a test Facebook Page, connect it (section 3). Expected: it shows Connected.
9. Open `/help`, `/pricing`, `/privacy`, `/terms`. Expected: they load and read well on a phone.
10. On a phone (or a narrow browser window): open the dashboard, Content, Calendar, and a post. Expected: nothing scrolls sideways except tables, which scroll inside their box. Buttons are easy to tap.
11. Keyboard only: press Tab on the home page. Expected: the first stop is "Skip to main content", and a visible outline follows you everywhere.
12. Sign out. Expected: the dashboard is no longer reachable.

## 3. Test Page publishing flow (needs your explicit approval first)

This is the only step that posts for real. Use a **test Facebook Page** that you own and that has no followers you care about. **STOP AND CONFIRM: you must decide to do this.**

1. Admin -> Publishing: check the scheduler heartbeat is recent (the scheduler is set up per `docs/SCHEDULER_SETUP.md`).
2. Connect the test Page (Pages -> Connect Facebook). Allow every permission.
3. Create a post, approve it, and schedule it 5 minutes ahead on the test Page. Expected: status Scheduled.
4. Admin -> Publishing: turn **live publishing ON** (tick the confirmation box).
5. Wait for the time. Expected: status goes to Published, and the post is visible on the test Page. LazyAI shows Published only after Facebook confirms.
6. Schedule a second post, then cancel it before its time. Expected: Canceled and nothing appears on the Page.
7. Disconnect the Page in Facebook's settings (remove the app), then check the Page in LazyAI. Expected: a clear "reconnect" message, not a raw code.
8. Turn **live publishing OFF** again unless you intend to keep it on.

Record the date and result in `docs/BUILD_PROGRESS.md`.

## 4. Security and legal

- [ ] Admin -> Deployment shows no secret values anywhere, and `NEXT_PUBLIC_` variables hold no secrets.
- [ ] `TOKEN_ENCRYPTION_KEY` and `CRON_SECRET` have a safe copy outside Vercel.
- [ ] Privacy Policy, Terms, Cookie Notice, and Acceptable Use were read by a lawyer for your country (they are good starting texts, not legal advice).
- [ ] `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL`, and `NEXT_PUBLIC_OPERATOR_COUNTRY` are set. The contact mailbox is read by a person.
- [ ] Meta app review status is known (section 5). Without approval, only people with a role on your Meta app can connect Pages.
- [ ] Spending limits are set in every paid provider dashboard (`docs/GO_LIVE_UPGRADE_CHECKLIST.md`).
- [ ] You know the rollback and incident steps (`docs/INCIDENTS.md`, `docs/DEPLOYMENT_RUNBOOK.md` section 7).

## 5. Outside approvals (LazyAI cannot do these for you)

| Provider | What is needed | Who decides |
|---|---|---|
| Meta | App Review for the Page permissions and switching the app to Live (see `docs/META_APP_REVIEW.md`). Business verification may also be asked for. Review can take several rounds. | Meta |
| Resend | A verified sending domain. Free plan limits apply (`docs/GO_LIVE_UPGRADE_CHECKLIST.md`). | You and Resend |
| AI providers | A paid key and a spending limit. Provider terms and prices change. | You |
| Vercel | Pro plan before taking payment (Hobby is for non-commercial use under Vercel's terms). | You |

## 6. Launch approval

Write this in the chat when you are ready, and only then will live posting for customers and public sign-up be treated as approved:

> I approve the production launch of LazyAI. I have completed sections 1 to 4 and I understand the limitations in `docs/KNOWN_LIMITATIONS.md`.

## 7. After launch (first week)

- Check Admin -> Publishing and Admin -> Email once a day.
- Read every message sent to the contact address.
- Watch the Vercel and Supabase usage pages for surprises.
