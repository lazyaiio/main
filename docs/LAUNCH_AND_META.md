# Launch checklist, Meta review, and new free tools (Batch 22)

No database change in this batch: nothing to run in Supabase. Upload the files and wait for Actions and Vercel to go green.

## Admin -> Launch
A go-live checklist with a percent bar and a clear "Ready to launch / Not ready yet".
- **Automatic items** are computed from the real site: production and https, no problems on the Deployment page, every migration run, support email / business name / country set, a paid plan priced, bKash saved and in live mode, email sending configured, Facebook set up for real, live publishing on, scheduler checked in within 10 minutes, blog articles published.
- **Manual items** are yours to tick ("Mark done" saves today's date, "Undo" removes it): walk-through of the live site, sandbox and live payment tests, test email in a real inbox, a test post on a real Page, Search Console, lawyer review, lifetime wording in the Terms, Meta business verification, Meta App Review, app switched to Live, paid hosting tiers, backup, support routine.
- **Required** items block "Ready to launch". Optional items are marked and never block.
- The list cannot see everything. "Ready" means every item on this list is done, not that nothing else can go wrong.

## Admin -> Meta review
- **Settings checks:** https, Meta app id and secret, token key, redirect address, real (not test) Facebook mode, support email, business name and country, live publishing, scheduler secret.
- **Pages Meta will open:** the site opens /privacy, /terms, /contact and /data-deletion the way a visitor would and reports a wrong status, an almost empty page, a missing support email on /contact, or a leftover square-bracket placeholder. If the site cannot fetch a page itself it says "could not check", never "failed".
- **Copy-and-paste pack:** the addresses for the Meta dashboard, draft answers for the three permissions LazyAI requests (pages_show_list, pages_read_engagement, pages_manage_posts), instructions for the reviewer, a two-minute screencast outline, and the usual reasons for rejection.
- LazyAI does **not** submit anything to Meta and cannot create the reviewer account or record the video. Edit every draft so it matches what you really do.

## New free tools
/tools/engagement-rate-calculator, /tools/utm-link-builder and /tools/hashtag-cleaner. They run in the browser, store nothing, appear on /tools and in the sitemap, and have search titles in Admin -> SEO like the others.
- Engagement rate = average engagements per post / followers x 100, and (if reach is given) total engagements / total reach x 100. No industry averages are claimed.
- The UTM builder lowercases values, turns spaces into hyphens, keeps other parameters and the #section, and replaces old utm_ values.
- The hashtag cleaner removes duplicates, empty and number-only tags, and can capitalize each word or limit the count.

## Quick test (20 minutes)
1. Admin -> Launch: check that the automatic items match what you know. Tick one manual item, reload, then undo it.
2. Admin -> Meta review: read the page checks. Use Copy on one permission answer and paste it somewhere.
3. Open each new tool in a private window, use the example button, copy the result.
4. Check /sitemap.xml lists the three tool addresses.
