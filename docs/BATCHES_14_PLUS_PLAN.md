# LazyAI: Batches 14 and later (owner's new requests)

Written after the owner's review of Batches 1 to 13. Same rules as `LAZYAI_MASTER_PLAN.md` section 23 (zip under 100 files, only changed files, list deletions, American English only, no Bengali in the site, free tiers, stop for approval before anything live or paid).

## Where each request goes

| # | Request | Batch |
|---|---|---|
| 1 | Images in campaign posts; Pexels/Pixabay keys in Admin | 14 |
| 2 | 500 to 750 word length | 14 |
| 3 | Pricing page and plans (Free, Pro, Advanced) editable from Admin | 15 |
| 4 | bKash merchant payments | 15 |
| 5 | Writing and scheduling continue with the browser closed | 14 |
| 6 | Remove review / approve / reject | 14 |
| 7 | Edit legal, home, about, contact pages from Admin | 16 |
| 8 | Analytics in Admin | 17 |
| 9 | OpenRouter model name | 14 |
| 10 | SEO tools in Admin | 18 |

## Batch 14: writing engine and simpler posts (code written, awaiting owner's checks)
See `BUILD_PROGRESS.md`. Migration 0014; Admin -> Stock photos; background campaign writing from the every-minute scheduler; optional automatic photo and automatic scheduling per campaign; no review step; extra long length; OpenRouter `openrouter/free`.

## Batch 15: plans, pricing page, bKash
- Plans become three: **Free, Pro, Advanced** (keys `free`, `pro`, `advanced`; the old `standard` plan is renamed or migrated).
- Admin -> Plans: edit name, tagline, monthly and yearly price, feature bullet list, limits, "most popular" flag, visible/hidden, order. Prices are stored in one site currency (default BDT; decide with owner).
- Public `/pricing` reads these from the database (no more "coming soon"); signed-in users see an Upgrade button.
- **bKash** (Tokenized Checkout: create payment, execute, query, refund later). Credentials (app key, secret, username, password, sandbox or live) saved encrypted in Admin -> Payments, with a test-connection button. Payment records table; plan changes only after the server confirms the payment with bKash; idempotent callbacks; receipts by email; plan expiry and renewal reminder.
- Needs from owner: bKash merchant API credentials (sandbox first), the prices, billing period rules (monthly only or also yearly), refund policy text.
- Approval needed before any live (real money) payment.

## Batch 16: editable site pages
- Admin -> Pages: edit Terms, Privacy, Cookies, Acceptable use, Data deletion, Help, Contact, About, and the home page text blocks (hero, features, how it works, FAQ, call to action).
- Stored in a `site_pages` table (title, body as structured blocks or safe Markdown, last edited, version history of the last 10 saves, "restore").
- Public pages read from the database and fall back to the current built-in text when nothing was saved. Content is sanitized; no raw HTML or scripts.
- Rule check: text saved in Admin must be American English (the Admin shows a reminder; Bengali characters are rejected).

## Batch 17: analytics
- First-party, privacy-friendly page view tracking (no third-party scripts): path, referrer, device type, browser, OS, country (from the hosting header), entry and exit page, session, new or returning, unique visitors via a daily-rotating hash (no raw IP stored), bots filtered.
- Admin -> Analytics: today, 7 days, 30 days, 12 months; daily/weekly/monthly/yearly views; traffic sources; top pages; entry and exit pages; devices; browsers; countries; sign-up conversion.
- Data retention setting and automatic cleanup. Cookie notice text updated.

## Batch 18: SEO tools
- Admin -> SEO: site title and description templates, default social image, per-page title and description, canonical URL, robots (index or noindex per page), sitemap and robots.txt controls, redirects manager, structured data (Organization, WebSite, FAQ), social cards.
- Verification tags: Google Search Console, Bing Webmaster, Yandex, Pinterest, Baidu, Facebook domain verification; Google Analytics 4, Google Tag Manager, Meta Pixel, Microsoft Clarity ids (loaded only after cookie consent).
- Checklist panel that shows what is missing (title length, missing description, no sitemap submitted).

## Batch 19: extras recommended for a SaaS like this
- Cookie consent banner (needed once analytics and tag ids exist).
- Payment and plan emails (receipt, expiring soon, expired).
- Admin user management (search users, change plan, suspend).
- Announcement banner and maintenance mode.
- Backup/export of site settings.
- Customer support inbox from the contact form.

## Order and checks
Each batch ends with: migration (if any) plus SQL test, changed-files zip, `BUILD_PROGRESS.md` entry, and a list of what was and was not verified. The owner reports CI, SQL results, and browser checks before the next batch starts.
