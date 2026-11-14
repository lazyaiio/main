# Page Insights (the Insights page in the app)

## What people get
**App -> Insights** shows, for each connected Page and for the last 7 or 28 days, compared with the 7 or 28 days before:
Views, People reached, Post engagements, Page visits, New followers, and Button and contact clicks (each with a small daily chart and a text version for screen readers), the follower count, and a table of the most recent posts LazyAI published (views, people reached, clicks, reactions).
Numbers are fetched only when someone with the Owner, Admin or Editor role presses **Get my numbers / Refresh numbers**; everyone in the workspace can look. A refresh within 30 minutes of the last one just shows what is saved (Facebook updates most numbers about once a day), and refreshes are limited to 12 per workspace per hour.

## What Facebook requires (from Meta's own Page Insights documentation, Graph API v26)
- Permissions `read_insights` and `pages_read_engagement`, a Page access token, and the connecting person must be able to do the **Analyze** task on the Page.
- Insights exist only for Pages with **at least 100 likes**. Most numbers update once every 24 hours. Only the last two years are kept, and only 90 days can be asked for at once.
- If `read_insights` was not granted, Facebook answers with an empty result.
- On June 15, 2026 Meta retired a number of Page Insights metrics. LazyAI uses only metrics that the current reference lists: `page_media_view`, `page_total_media_view_unique`, `page_post_engagements`, `page_views_total`, `page_daily_follows_unique`, `page_total_actions`, and for posts `post_media_view`, `post_total_media_view_unique`, `post_clicks`, `post_reactions_by_type_total`. Each metric is requested on its own, so if Meta retires another one, that card says "Facebook no longer offers this number" and the rest keep working.

## Turning it on (do this in order)
1. Run `supabase/migrations/0025_page_insights.sql`, then `supabase/tests/rls_page_insights.sql` (expect `ALL PAGE INSIGHTS TESTS PASSED`). Upload the code.
2. Until Meta approves `read_insights`, leave `META_REQUEST_INSIGHTS` unset (or 0). The Insights page then says "coming soon". Nothing about connecting or publishing changes, and people are not asked for the extra permission.
3. In the Meta developer dashboard add `read_insights` to the app and request **Advanced Access** for it in App Review, together with the other three. Use Admin -> Meta review for the draft answer, the reviewer instructions and the screencast outline (it now includes the Insights step). Record the screencast on a Page with at least 100 likes, or Facebook returns nothing and the reviewer sees an empty screen.
4. If you use **Facebook Login for Business** (`META_LOGIN_CONFIG_ID` is set), add `read_insights` to that configuration in the Meta dashboard. The code cannot change a configuration; `META_REQUEST_INSIGHTS` only matters for the classic login.
5. After approval set `META_REQUEST_INSIGHTS=1` in Vercel and redeploy.
6. People who connected Facebook earlier must **reconnect** once (Facebook Pages -> Connect Facebook). Their Insights page tells them so ("Reconnect Facebook to see Insights"). Pages and scheduled posts are not affected.

While you test with your own account (a role on the Meta app), `META_REQUEST_INSIGHTS=1` works before approval; ordinary people cannot grant the permission until approval.

## Privacy and deletion
- Saved numbers: one copy per Page and range in `page_insight_snapshots` (totals and post titles only, no personal data about individual viewers). A refresh replaces it. Disconnecting a Page, Facebook's data-deletion request, deleting the workspace, and deleting the Page all remove it.
- The default Privacy Policy now describes Insights (what is received, why, and how long it is kept). **If you edited the Privacy Policy in Admin -> Pages, the new text is NOT applied to your edited copy: add the same points yourself** (sections "Information from Facebook", "Facebook and Meta Platform data" and "How long we keep information"). Have your lawyer read it.
- Nothing from Insights is sent to AI providers, sold, or used for advertising.

## Try it without Facebook
In test mode (`META_MOCK=1`, outside production, the pretend Facebook) Insights is always on and shows made-up but stable numbers, so you can look at the screens. The pretend Page called "Mock Analyst Page" cannot publish but can show Insights.

## Quick test (15 minutes)
1. Test mode: connect the pretend Facebook, open Insights, press Get my numbers, switch between 7 and 28 days, and check every card and the posts table.
2. Real Facebook (your own account, `META_REQUEST_INSIGHTS=1`): reconnect, then Get my numbers on a Page with at least 100 likes. Compare Views and engagements with the numbers in Facebook's own Insights.
3. Disconnect the Page and reconnect it: the old numbers must be gone until you refresh.
4. As a Viewer: you can see the numbers but not the Refresh button.
