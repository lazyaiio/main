# SEO setup (Batch 18, migration 0021)

Admin -> **SEO** has a health check, site settings, page-by-page titles and descriptions, search engine verification, and optional analytics/ad tags.

## One-time steps (about 20 minutes)
1. Run `0021_seo.sql`. Deploy.
2. Admin -> SEO -> **Site settings**: check the home title and the site description (the health check shows green when the lengths are good). Add a **share image** (1200 x 630 pixels, hosted on an https address) and a **logo** address. Add your Facebook Page and other profile links.
3. **Google Search Console** (search.google.com/search-console): add the property `https://lazyai.io`, choose the **HTML tag** method, paste the tag (or only its code) in Admin -> SEO -> Search engine verification, save, then press Verify in Google. Then submit `https://lazyai.io/sitemap.xml` under Sitemaps.
4. **Bing Webmaster Tools** (bing.com/webmasters): either import the site from Google Search Console or add the site and paste the `msvalidate.01` code. Submit the same sitemap.
5. Optional: Pinterest / Yandex / Baidu / Facebook domain verification in the same box.
6. Open `/robots.txt` and `/sitemap.xml` on the live site and check them.

## What the site does for search engines
- Every public page has its own title, description, canonical address, and Open Graph / X cards. Edit them per page in Admin -> SEO -> Pages.
- `robots.txt` and `sitemap.xml` are built from your settings. Private areas (app, admin, sign-in, checkout, API) are blocked in robots.txt, marked `noindex`, and also sent with an `X-Robots-Tag: noindex` header.
- Structured data (JSON-LD): Organization and WebSite on the home page, SoftwareApplication with the plans as offers on Pricing, breadcrumbs on the other pages.
- Pages you hide ("Hide from search engines") are left out of the sitemap.

## Optional tags and consent
Google Analytics 4, Google Tag Manager, Meta Pixel, and Microsoft Clarity IDs can be added. They load **only on the public pages** and **only after the visitor presses Accept** in the cookie banner (the choice is kept in the browser; the footer has a "Cookie choices" link). The cookie banner shows only when at least one tag is set. Our own statistics (Admin -> Analytics) need none of this.
- If you use Tag Manager, put Google Analytics inside it and leave the GA4 box empty, otherwise visits are counted twice.
- The Meta Pixel is an advertising tool. The built-in Privacy Policy says LazyAI does not use information for advertising: change that sentence (Admin -> Pages -> Privacy) before adding a Pixel. Also confirm what your law requires for consent.

## Honest limits
- Titles and descriptions help, but rankings come from content, links, and time. A new site can take weeks or months to appear.
- Country and language targeting: the site is English only (`en-US`); there are no alternate-language pages.
- The redirect manager (301s) and a 404 report are not included yet.
