# Content guide: topic silos, long-tail articles, docs, tables, and diagrams (Batches 24, 26, 27, and 28)

## How the blog is organized (topic silos)
Each of the three topics is a silo: one main (pillar) article, and supporting articles that each answer one specific question people search for. Every supporting article links up to its pillar, and the pillar links down to all of them. The article page also lists related articles by itself, so you never have to edit old articles to keep them connected.

| Silo | Pillar article | Supporting articles (long-tail searches) |
|---|---|---|
| Content planning | How to plan a month of Facebook content | Post ideas for small businesses; Post ideas for restaurants, salons, online shops, and real estate agents; Seasonal content calendar for local businesses; How to do a Page content audit; How often to post; Page metrics explained; How to calculate engagement rate; Content calendar template; How to grow Page followers organically; Repurposing one article into a week of posts |
| Writing posts | How to write Facebook posts people read | Hooks and calls to action; Post templates; Replying to comments and reviews; Writing a sale or offer post; Writing a new product post; Captions for photos; Giveaway rules; How many hashtags to use; How long a post should be |
| Scheduling and AI | How to schedule Facebook Page posts | Using AI to write posts; Meta Business Suite vs a scheduling tool; Track post clicks with UTM links; UTM naming convention; Best time to post; Why a scheduled post failed; AI prompts for Facebook posts; Scheduling a month of posts in one hour |

Every free tool links to its guides ("Guides for this tool"), and every guide links to its tool. That two-way link is the main way the tools get found in search.

## Search terms the new articles aim at
calculate engagement rate on facebook; utm parameters naming convention; how many hashtags to use on facebook; how long should a facebook post be; grow facebook page followers organically; best time to post on facebook; facebook content calendar template; track facebook post clicks; facebook giveaway rules; facebook page metrics.
Rankings are never promised. New sites usually need months, links, and steady work.

## Honesty rules used in the articles
- No invented statistics, studies, or "best time" numbers. Where advice is our own opinion, the article says so and tells readers how to test it on their own Page.
- No competitor prices or feature lists unless checked on that company's own pages.
- Example numbers (such as a bakery with 1,200 followers) are plainly examples.

## Adding content
- **Blog:** Admin -> Blog -> "Add starter articles" adds the 33 starter articles you do not have yet, as drafts. Read each one, find photos, change anything that is not true for your business, and publish.
- **Tables:** write them in Markdown (a header row, a `|---|---|` line, then rows). They work in the blog and in the docs.
- **Diagrams:** a line such as `[[diagram: workflow]]` shows one of four built-in diagrams: `workflow`, `lifecycle`, `funnel`, `rhythm`. They contain ideas and steps, never data.
- **Screenshots:** see `docs/SCREENSHOT_GUIDE.md`.
- **Docs pages:** they live in `src/content/docs.ts`. A test checks that every link inside them points to a page that exists, and that tables and diagrams are valid.

## Batch 26: seven more long-tail articles
Restaurant post ideas, repurposing one article into five posts, twelve fill-in-the-blank templates, replying to comments and reviews, why a scheduled post failed, twenty AI prompts, and scheduling a month in one hour. Each is 1,250+ words with four photo spots, links up to its pillar, and links to at least one tool or sibling article. Like the earlier ones they arrive as drafts. Read each one, and change anything that is not true for your business. The failure-causes article describes common causes in general terms; it does not quote Meta error codes or limits, because those change.

## Batch 27: four more long-tail articles
Post ideas for salons, post ideas for online shops, how to write a Facebook post for a sale or offer, and how to write a Facebook post about a new product. Same rules as Batch 26: drafts, four photo spots each, honest numbers only. Salon advice covers asking clients for permission before posting their photos. Offer advice tells readers to check local rules on price claims; it is general guidance, not legal advice.

## Batch 28: four more long-tail articles
Post ideas for real estate agents, a seasonal content calendar for local businesses, how to do a Facebook Page content audit, and Facebook captions for photos. Same rules as before: drafts, four photo spots each, no invented statistics. The real estate article gives general habits about permission, accuracy, and fair wording, and tells readers to check their local advertising rules; it is not legal advice. The seasonal article gives example hooks, not dates, because holidays and seasons differ by country.

## What this batch does not include
- Real screenshots (you add them; see the guide).
- Charts of real data: there is no honest data to chart yet. The four diagrams and the many tables are used instead.
- A visual check of the pages in a browser. The diagrams were rendered and looked at; the pages themselves were not.
