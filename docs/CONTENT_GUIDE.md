# Content guide: topic silos, long-tail articles, docs, tables, and diagrams (Batch 24)

## How the blog is organized (topic silos)
Each of the three topics is a silo: one main (pillar) article, and supporting articles that each answer one specific question people search for. Every supporting article links up to its pillar, and the pillar links down to all of them. The article page also lists related articles by itself, so you never have to edit old articles to keep them connected.

| Silo | Pillar article | Supporting articles (long-tail searches) |
|---|---|---|
| Content planning | How to plan a month of Facebook content | Post ideas for small businesses; How often to post; Page metrics explained; How to calculate engagement rate; Content calendar template; How to grow Page followers organically |
| Writing posts | How to write Facebook posts people read | Hooks and calls to action; Giveaway rules; How many hashtags to use; How long a post should be |
| Scheduling and AI | How to schedule Facebook Page posts | Using AI to write posts; Meta Business Suite vs a scheduling tool; Track post clicks with UTM links; UTM naming convention; Best time to post |

Every free tool links to its guides ("Guides for this tool"), and every guide links to its tool. That two-way link is the main way the tools get found in search.

## Search terms the new articles aim at
calculate engagement rate on facebook; utm parameters naming convention; how many hashtags to use on facebook; how long should a facebook post be; grow facebook page followers organically; best time to post on facebook; facebook content calendar template; track facebook post clicks; facebook giveaway rules; facebook page metrics.
Rankings are never promised. New sites usually need months, links, and steady work.

## Honesty rules used in the articles
- No invented statistics, studies, or "best time" numbers. Where advice is our own opinion, the article says so and tells readers how to test it on their own Page.
- No competitor prices or feature lists unless checked on that company's own pages.
- Example numbers (such as a bakery with 1,200 followers) are plainly examples.

## Adding content
- **Blog:** Admin -> Blog -> "Add starter articles" adds the 18 starter articles you do not have yet, as drafts. Read each one, find photos, change anything that is not true for your business, and publish.
- **Tables:** write them in Markdown (a header row, a `|---|---|` line, then rows). They work in the blog and in the docs.
- **Diagrams:** a line such as `[[diagram: workflow]]` shows one of four built-in diagrams: `workflow`, `lifecycle`, `funnel`, `rhythm`. They contain ideas and steps, never data.
- **Screenshots:** see `docs/SCREENSHOT_GUIDE.md`.
- **Docs pages:** they live in `src/content/docs.ts`. A test checks that every link inside them points to a page that exists, and that tables and diagrams are valid.

## What this batch does not include
- Real screenshots (you add them; see the guide).
- Charts of real data: there is no honest data to chart yet. The four diagrams and the many tables are used instead.
- A visual check of the pages in a browser. The diagrams were rendered and looked at; the pages themselves were not.
