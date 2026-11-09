# Blog and free tools (Batch 19, migration 0022)

## One-time setup
1. Run `0022_blog.sql` in the Supabase SQL Editor (creates the blog tables, three categories, and a **public** storage bucket named `blog`).
2. Upload the code. Make sure **Admin -> Stock photos** has a working Pixabay and/or Unsplash key (the blog's photo finder uses it).
3. Open **Admin -> Blog** -> **Add 8 starter articles**. They arrive as drafts.
4. Open each article -> **Find the photos**. This fills the four `[[image: …]]` spots and the featured image from Pixabay and Unsplash (it can take up to a minute). Check that each photo matches the text; use **Replace** or **Search stock photos** to change any.
5. Read the article, edit it, fix the checklist items, then **Publish now** (or **Schedule**).
6. Publish the three pillar guides first, then the supporting articles. Open `/blog`, `/blog/category/<topic>`, `/sitemap.xml`, and `/blog/rss.xml` and check them.
7. In Google Search Console, inspect the new article addresses and request indexing.

## How the blog works
- Articles are Markdown. A photo is one line: `![what it shows](blog-image:<id>)`. A line `[[image: search words | what it shows]]` is a placeholder; readers never see it.
- Each article has a search title, a search description, a short summary (for cards), a focus keyword, tags, a category, and an author. The **SEO checklist** beside the editor shows length, headings, photos, links to other pages, and keyword placement.
- **Silos:** three categories (Content Planning, Writing Posts, Scheduling and AI). Each can have **one pillar guide**; the other articles link up to it, and each article page shows "Part of our guide: …", related articles from the same silo, and a link to a free tool that fits the topic.
- Photos are saved with their credit (photographer and provider) and shown under the picture. Photos are stored in your own storage; the same photo is not used twice.
- An article is public only when it is Published and its time has come. Scheduling needs no extra job. Drafts and scheduled articles can be previewed by admins.
- The blog is English only (American English). Bengali characters are refused on save.

## Free tools
`/tools` has three tools that run in the visitor's browser (nothing is sent to your server): the post idea generator, the content calendar generator (CSV download), and the post checker. Their titles and descriptions can be edited in Admin -> SEO -> Pages. Each tool page lists related guides from the matching category.

## Honest limits
- Search rankings come from useful content, links, and time; a new domain can take months. Publishing eight articles is a start, not a result.
- The starter articles were written without keyword-volume data. Use Search Console (after a few weeks) and a keyword tool to choose the next ones; see `docs/TOPICAL_MAP.md`.
- Please read every article and add your own experience, screenshots of LazyAI, and real examples before publishing. Check facts that can change (for example the names of Facebook's scheduling menus).
