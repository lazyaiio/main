/**
 * The LazyAI user guides (shown at /docs). Plain Markdown in the site's own reader: headings, lists, tables,
 * links, [[diagram: name]] and [[screenshot: name | description]] lines (a screenshot shows only after it has been added;
 * see src/content/screenshots.ts). Everything here describes what the app really does; if the app changes, change the guide.
 */

export type DocPage = { slug: string; title: string; description: string; group: string; updated: string; body: string };

export const DOC_GROUPS = ["Start here", "Create and publish", "Money and data", "Help"] as const;

export const DOCS: DocPage[] = [
  {
    slug: "getting-started",
    title: "Getting started with LazyAI",
    description: "Set up your account, connect a Facebook Page, and publish your first scheduled post in about ten minutes.",
    group: "Start here",
    updated: "2026-11-15",
    body: `LazyAI helps you plan, write, and schedule posts for your Facebook Page. You give it a topic or a link. It writes drafts. You read and edit them, then schedule the ones you like. Nothing is published unless you schedule it.

[[diagram: workflow]]

## Before you begin

- You need a Facebook **Page** (not a personal profile) and a role on it that lets you create posts.
- You need an email address to create your account. We send a message to confirm it.
- Have a topic in mind, or the web address of an article you want to write about.

## Set up in six steps

1. **Create your account** and confirm your email.
2. **Finish the short setup:** your name, your workspace name, and your time zone. Posts are scheduled in your workspace time zone. You can change it later in **Settings**.
3. **Connect Facebook:** open **Pages**, choose **Connect Facebook**, allow every permission Facebook shows, and pick your Page. See [Connect a Facebook Page](/docs/connect-facebook).
4. **Create a project** for your business or topic. Posts and campaigns belong to a project.
5. **Write a post:** open **Content**, choose **New**, and generate a draft. See [Write posts with AI](/docs/write-posts).
6. **Schedule it:** pick the Page and a time a few minutes from now or later. See [Schedule and publish](/docs/schedule-and-publish).

[[screenshot: dashboard | The LazyAI dashboard after sign-in]]

## What each menu item does

| Menu item | What it is for |
|---|---|
| Dashboard | Your starting point and a quick look at your workspace |
| Projects | One project per business or topic. Posts and campaigns live inside a project |
| Campaigns | Plan many posts at once from one topic |
| Content | Write single posts, edit drafts, and schedule them |
| Calendar | See what is scheduled and when |
| Pages | Connect and disconnect your Facebook Pages |
| Media | Your uploaded images and the stock photos you added |
| Insights | How your Page is doing, when this feature is switched on. See [Page Insights](/docs/insights) |
| Activity | A record of important actions in your workspace |
| Billing | Your plan, payments, and invoices |
| Settings | Workspace name, time zone, email choices, your data, and account deletion |

## A good first week

- **Day 1:** connect your Page and write one post. Read every word before you schedule it.
- **Day 2:** write three more posts on one topic and schedule them across the week.
- **Day 7:** look at what happened on your Page and decide what to repeat. Our guide to [Facebook Page metrics](/blog/facebook-page-metrics-explained) explains the numbers.

## Need help?

Start with [Fix common problems](/docs/troubleshooting). If that does not solve it, write to us from the [Contact page](/contact).`,
  },
  {
    slug: "connect-facebook",
    title: "Connect a Facebook Page",
    description: "How to connect your Facebook Page to LazyAI, which permissions it asks for, and how to disconnect or fix a connection.",
    group: "Start here",
    updated: "2026-11-15",
    body: `LazyAI publishes to your Page through Facebook's official login. You choose the Page, you approve each permission, and you can disconnect at any time.

## What you need

- A Facebook **Page**. Personal profiles are not supported.
- A role on the Page that lets you create posts.
- A LazyAI account with a confirmed email address.

## Connect your Page

1. Open **Pages** in the left menu.
2. Choose **Connect Facebook**. Facebook asks you to approve the connection.
3. Sign in to Facebook if it asks you to.
4. **Allow every permission Facebook shows.** If you turn one off, LazyAI cannot finish the connection.
5. Pick the Page you want to use.
6. The Page appears in your **Pages** list as connected.

[[screenshot: connect-facebook | The Pages screen with a connected Facebook Page]]

## What each permission is used for

| Permission | What LazyAI uses it for |
|---|---|
| pages_show_list | Shows the Pages you manage, so you can choose which to connect |
| pages_read_engagement | Reads basic details of the Page you chose (name, category, follower and like counts) and checks that the connection works |
| pages_manage_posts | Publishes the posts you scheduled, at the time you chose |
| read_insights (optional) | Shows how your Page is doing on the Insights page. Asked for only when Insights is switched on |

LazyAI does not receive your Facebook password, your friends list, your private messages, or the posts on your personal profile. Page access is stored in encrypted form. See our [Privacy Policy](/privacy) for the details.

## If the connection stops working

A Page can need to be reconnected when Facebook access was removed or expired, or when your role on the Page changed. LazyAI shows a message on the Page. Open **Pages** and connect again. Your posts and schedules are kept.

## Disconnect a Page

- **In LazyAI:** open **Pages** and choose **Disconnect** next to the Page. LazyAI deletes its stored access for that Page right away.
- **In Facebook:** open **Settings**, then **Business Integrations**, find LazyAI, and choose **Remove**. Facebook tells LazyAI, and LazyAI disconnects your Pages.

Posts that are already on your Page stay there. To ask us to delete other data, see [Your data and account](/docs/your-data-and-account).`,
  },
  {
    slug: "write-posts",
    title: "Write posts with AI",
    description: "Create a post from a topic or an article link, choose English or Bengali, and review it before you schedule it.",
    group: "Create and publish",
    updated: "2026-11-15",
    body: `LazyAI writes a first draft. You decide what goes out. This guide shows how to get a good draft and what to check before you schedule it.

## Write one post

1. Open **Content** and choose **New**.
2. Pick the **project** the post belongs to.
3. Write the **topic**: what the post should be about, in a sentence or two. Add facts the post must include, such as a price, a date, or a place.
4. Choose the **language**, English or Bengali.
5. Choose **Generate**.
6. Read the draft and edit every part you want to change.

[[screenshot: new-post | The new post screen with a topic and a language]]

## Write a post from an article

Paste the web address of a public article or page. LazyAI reads the page and writes an original post about it. Pages behind a login or a paywall cannot be read. Always add your own view, and link to the source when you quote it.

## Get better drafts

| Do this | Why it helps |
|---|---|
| Name the customer and the benefit in your topic | The draft talks about a real person, not about everything |
| Give two or three real facts | The AI cannot know your prices, opening hours, or offers |
| Say what you want the reader to do | A clear next step makes a stronger ending |
| Keep one idea per post | Short posts with one point are easier to read |
| Generate again if the first draft is off | You can try a new version. Each generation counts toward your plan's limits |

For more ideas, read how to [write Facebook posts people read](/blog/how-to-write-facebook-posts-people-read) and our guide to [using AI to write Facebook posts](/blog/how-to-use-ai-to-write-facebook-posts). The free [post checker](/tools/post-checker) gives quick feedback on a draft.

## Review before you schedule

AI can make mistakes. You are responsible for every post. Check this list each time.

| Check | Question to ask |
|---|---|
| Facts | Are the prices, dates, names, and claims correct? |
| Promises | Can you really keep every offer or promise in the post? |
| Links | Does each link open the right page? |
| Tone | Does it sound like your business? |
| Rights | Do you have the right to use every image and quote? |
| Rules | Does it follow Facebook's rules and the law? |

Saving a draft never changes its status. When you are happy with it, schedule it. See [Schedule and publish](/docs/schedule-and-publish).`,
  },
  {
    slug: "plan-a-campaign",
    title: "Plan a campaign",
    description: "Write many posts at once from one topic with Campaigns, then review, edit, and schedule them.",
    group: "Create and publish",
    updated: "2026-11-15",
    body: `A campaign plans and writes a set of posts in one go. It is the quickest way to fill a week or a month.

## When to use a campaign

- You want a steady stream of posts about one topic, such as a launch or a season.
- You would rather review a full set than write posts one at a time.
- You want to plan a set of posts across the days you choose.

For a single post, use **Content** instead. See [Write posts with AI](/docs/write-posts).

## Start a campaign

1. Open **Campaigns** and start a new one.
2. Choose the **project** it belongs to.
3. Describe the **topic** and what you want people to do.
4. Choose how many posts you want and the days to cover.
5. Start the campaign.

Campaign posts are written in small batches, so a long campaign can take a few minutes. You can leave the page and come back. The campaign keeps working.

## Review the posts

Each post in a campaign is a normal post. Open it, read it, edit it, and schedule it. You can regenerate a post you do not like.

[[diagram: rhythm]]

## Choose a rhythm you can keep

A small, steady schedule beats a big burst that stops after two weeks. A light weekly pattern is easier to keep. Our guide to [how often to post on Facebook](/blog/how-often-should-you-post-on-facebook) explains how to choose, and [how to plan a month of Facebook content](/blog/how-to-plan-a-month-of-facebook-content) shows a full plan. The free [content calendar generator](/tools/content-calendar-generator) can sketch a month for you.

## Tips

| Tip | Why |
|---|---|
| Start with 4 to 8 posts | You can review them all in one sitting |
| Mix the jobs of your posts | Teach, show, offer, and ask keep the Page interesting |
| Keep one campaign topic focused | Posts that wander are harder to read |
| Read every post before scheduling | Long campaigns can repeat ideas or miss a fact |`,
  },
  {
    slug: "schedule-and-publish",
    title: "Schedule and publish posts",
    description: "Pick a time, understand each post status, use the calendar, and fix a post that did not go out.",
    group: "Create and publish",
    updated: "2026-11-15",
    body: `You choose the time. LazyAI publishes the post to your Page at that time and tells you what happened.

## Schedule a post

1. Open the post. A new post is **ready** right away.
2. Read it, and edit it if you like. Saving does not change its status.
3. Pick the connected **Page**.
4. Pick a **date and time**. The time must be a few minutes from now or later. It uses your workspace time zone, which you can change in **Settings**.
5. Choose **Schedule**.

Use **Calendar** to see everything that is planned. You can change the time or cancel a scheduled post at any time before it goes out. If your readers live in other time zones, the free [time zone converter](/tools/time-zone-converter) shows what time your post will be for them.

[[screenshot: calendar | The calendar with scheduled posts]]

## What each status means

[[diagram: lifecycle]]

| Status | Meaning |
|---|---|
| Scheduled | Waiting for its time |
| Publishing | Being sent to Facebook right now |
| Retrying | Facebook asked LazyAI to wait, or there was a short problem. It tries again automatically |
| Published | Facebook confirmed the post. LazyAI never shows Published before that |
| Failed | The post did not go out. The reason is on the post, with a button to retry |
| Canceled | You stopped it. Nothing was posted |

## When a post could not be confirmed

Sometimes the connection drops at the exact moment a post is sent, so LazyAI cannot tell whether it reached Facebook. To avoid posting twice, it does not retry by itself. Open your Page and look. Then choose **It is on my Page**, or **It is not there: post it again**.

## When a post is very late

If the service was down when a post was due, LazyAI does not publish it more than 6 hours late by surprise. Retry the post, or choose a new time.

## Good habits

- Schedule a few days ahead so you can fix problems calmly.
- Check the Page once after your first scheduled post goes out.
- Tag the links in your posts so you can see which ones bring visitors. See [track Facebook post clicks with UTM links](/blog/track-facebook-post-clicks-with-utm-links).
- Our guide to [scheduling Facebook Page posts](/blog/how-to-schedule-facebook-page-posts) compares the ways to do it.`,
  },
  {
    slug: "images-and-media",
    title: "Add images and stock photos",
    description: "Upload your own images, add free stock photos, and write alt text. File limits and tips.",
    group: "Create and publish",
    updated: "2026-11-15",
    body: `Posts with a good image are easier to notice. You can upload your own photos or add free stock photos.

## Upload your own image

1. Open **Media**, or open a post and use its image area.
2. Choose a file from your device.
3. Add a short description (alt text).
4. Attach the image to your post.

## File limits

| Rule | Limit |
|---|---|
| File types | JPG, PNG, WebP, or GIF |
| File size | Up to 4 MB |
| Size in pixels | Up to 8,000 pixels on the longest side |

If a file is too large, make it smaller with an image editor and upload it again.

## Stock photos

LazyAI can find free stock photos for a post. The words used to search (typed by you, or taken from the post's image idea when you choose automatic photos) go to the photo provider. Photos you add are copied into your private storage. Read the license note for any photo you use.

## Write good alt text

Alt text describes the image for people who cannot see it. It also helps if the image does not load.

- Say what is in the picture in one short sentence.
- Do not start with "image of".
- Include any words that are written in the picture.

## Tips

- Use your own photos of your real products and people when you can.
- Use a clear photo with one subject instead of a busy one.
- Never use an image you do not have the right to use.`,
  },
  {
    slug: "plans-and-billing",
    title: "Plans, payments, and invoices",
    description: "Choose a plan, pay with bKash, understand monthly, yearly, and lifetime plans, and what happens when a plan ends.",
    group: "Money and data",
    updated: "2026-11-15",
    body: `You can start for free and upgrade when you need more. See the [pricing page](/pricing) for the current plans, prices, and limits.

## How to upgrade

1. Open **Billing** and choose a plan.
2. Choose how you want to pay for it: monthly, yearly, or lifetime, where the plan offers them.
3. Pay with bKash. You enter your bKash details on bKash's own page. LazyAI never sees your PIN.
4. When bKash confirms the payment, your plan changes right away and we email you a receipt.


## The three ways to pay

| Option | What it means |
|---|---|
| Monthly | One payment for one month. You renew when you choose to |
| Yearly | One payment for a year. Compare it with monthly on the [pricing page](/pricing). You renew when you choose to |
| Lifetime | One payment with no renewals, where a plan offers it. An offer can end, so check the pricing page |

Nothing is charged automatically. LazyAI does not store your payment details and does not renew a plan by itself.

## Renewing and what happens when a plan ends

- If you pay again for the same plan before it ends, the new time is added to the end of your current plan.
- We email you about a week before a monthly or yearly plan ends.
- When it ends, your workspace moves to the Free plan. Your content is not deleted. Free plan limits apply from then on.
- Lifetime plans do not end.

## Invoices and receipts

Each payment has an invoice number and a receipt email. You can see your payments on the **Billing** page. Keep the receipt for your records.

## Refunds and problems

If a payment went through but your plan did not change, or you need a refund, contact us from the [Contact page](/contact) with your invoice number. Please never send a PIN or a password.`,
  },
  {
    slug: "insights",
    title: "Page Insights",
    description: "See how your Facebook Page is doing: views, people reached, engagements, and followers. Requirements, what each number means, and how refreshing works.",
    group: "Money and data",
    updated: "2026-11-15",
    body: `The **Insights** page shows how your connected Facebook Page and your recent posts are doing. The numbers come from Facebook.

If you see "Insights are coming soon", the feature is not switched on yet. Facebook has to approve it for LazyAI first, and nothing is needed from you.

## What you need

- A connected Page.
- A Page with **at least 100 likes**. Facebook only provides Insights for those Pages.
- The **Analyze** role on the Page for the person who connected it.
- A connection that allows Insights. If you connected Facebook before this feature existed, LazyAI asks you to connect again. Your Pages and scheduled posts are not affected.

## How to use it

1. Open **Insights** and choose your Page.
2. Choose the last 7 or 28 days. Each number is compared with the same length of time just before.
3. Choose **Get my numbers** the first time, or **Refresh numbers** later.

[[screenshot: insights | The Insights page with numbers for the last 28 days]]

## What each number means

[[diagram: funnel]]

| Number | What it shows |
|---|---|
| Views | How many times your content was played or displayed |
| People reached | How many different people saw your content. Facebook says this is an estimate |
| Post engagements | Reactions, comments, shares, and more on your posts |
| Page visits | How many times your Page's profile was viewed |
| New followers | New people who followed your Page. Facebook says this is an estimate |
| Button and contact clicks | Clicks on your Page's contact details and call-to-action button |

The posts table shows views, people reached, clicks, and reactions for the most recent posts that LazyAI published for you.

## How refreshing works

- Facebook updates most numbers about once a day, so asking more often adds little.
- If you refresh again within 30 minutes, LazyAI shows what it already has.
- Owners, admins, and editors can refresh. Everyone in the workspace can look.
- The numbers are saved as one copy for each Page and time range. A refresh replaces the copy. Disconnecting a Page deletes it.

## If a number says it is unavailable

Facebook changes and retires some numbers from time to time. If it no longer offers one, that card says so and the others keep working. Read [Facebook Page metrics explained](/blog/facebook-page-metrics-explained) to learn how to use the numbers, and try the [engagement rate calculator](/tools/engagement-rate-calculator).`,
  },
  {
    slug: "your-data-and-account",
    title: "Your data and your account",
    description: "Download your data, disconnect Facebook, remove LazyAI from Facebook, and delete your account.",
    group: "Money and data",
    updated: "2026-11-15",
    body: `You are in control of your data. Here is how to see it, take it with you, and remove it.

## Download a copy

Open **Settings**, then **Your data**, and choose **Download my data**. You get your content, schedules, and activity as a file.

## Disconnect Facebook

Open **Pages** and choose **Disconnect** next to a Page. LazyAI deletes its stored access for that Page right away, and the saved Insights numbers for it too. To remove LazyAI from inside Facebook, use **Settings**, then **Business Integrations**.

## Delete your account

Open **Settings** and use **Delete my account** at the bottom. You confirm with your password and by typing DELETE. This permanently deletes your account, your workspace, and everything in it, including your Facebook connections. Posts that are already on Facebook stay there.

## What we may keep

We may keep limited records that the law requires or that are needed to resolve disputes. Payment records (invoice, amount, date, plan, and transaction ID) are kept for accounting and tax purposes. Copies in backups are overwritten on the provider's normal schedule.

## More

| Need | Where |
|---|---|
| How we handle information | [Privacy Policy](/privacy) |
| Delete data connected to Facebook | [Data Deletion](/data-deletion) |
| Cookies | [Cookie Notice](/cookies) |
| Ask a question | [Contact](/contact) |`,
  },
  {
    slug: "troubleshooting",
    title: "Fix common problems",
    description: "A quick table of common problems with LazyAI and Facebook publishing, why they happen, and how to fix them.",
    group: "Help",
    updated: "2026-11-15",
    body: `Find your problem in the table. If it is not here, write to us from the [Contact page](/contact).

## Connection problems

| What you see | Likely reason | What to do |
|---|---|---|
| The Page needs to be reconnected | Facebook access was removed or expired, or your role on the Page changed | Open **Pages** and connect again. Your posts and schedules are kept |
| The connection did not finish | A permission was turned off in Facebook's window | Connect again and allow every permission shown |
| You do not see your Page in the list | You do not have a role that lets you manage it | Ask a Page admin to give you a role, then connect again |

## Publishing problems

| What you see | Likely reason | What to do |
|---|---|---|
| A post says it could not be confirmed | The connection dropped while the post was being sent | Open your Page and look, then choose **It is on my Page** or **It is not there: post it again** |
| A post is marked late | The service was down when the post was due | Retry it, or choose a new time |
| A post failed | Facebook refused it or there was a problem | Read the reason on the post, fix it, and retry |
| You cannot pick a time | The time is too soon or in the past | Choose a time a few minutes from now or later |
| The post time looks wrong | Your workspace time zone is not the one you expect | Change the time zone in **Settings** |

## Writing problems

| What you see | Likely reason | What to do |
|---|---|---|
| A link could not be read | The page is behind a login or a paywall | Use a public page, or paste the key points as the topic |
| A campaign is still running | Campaigns are written in small batches | Wait a few minutes. You can leave the page and come back |
| The draft is wrong or vague | The topic was too general | Add facts and a clear goal, then generate again |

## Account problems

| What you see | Likely reason | What to do |
|---|---|---|
| No confirmation email | It may be in spam, or the address has a typo | Check your spam folder, then request it again |
| You cannot create or change things | Your email is not confirmed, or your account is suspended | Confirm your email, or contact us |
| A payment went through but the plan did not change | The confirmation is delayed | Wait a few minutes, then contact us with your invoice number |

## Images

| What you see | Likely reason | What to do |
|---|---|---|
| An upload is refused | The file is too large or the wrong type | Use JPG, PNG, WebP, or GIF, up to 4 MB and 8,000 pixels |

## Still stuck?

Write to us and tell us what you clicked and what you saw. Never send a password. See [Getting started](/docs/getting-started) if you want to review the basics.`,
  },
  {
    slug: "glossary",
    title: "Glossary: Facebook marketing terms",
    description: "Plain-English meanings of the words you meet when you plan, write, schedule, and measure Facebook posts.",
    group: "Help",
    updated: "2026-11-15",
    body: `Short, plain meanings of common terms. Each links to a longer guide where there is one.

## Posting and planning

| Term | Meaning |
|---|---|
| Content calendar | A plan of what you will post and when. See [plan a month of Facebook content](/blog/how-to-plan-a-month-of-facebook-content) |
| Campaign | A set of posts about one topic or goal |
| Scheduling | Choosing a future time for a post to go out |
| Call to action | The thing you ask the reader to do, such as message you or visit a page. See [hooks and calls to action](/blog/facebook-post-hooks-and-calls-to-action) |
| Hook | The first line of a post, which decides whether people keep reading |
| Hashtag | A word with a # sign in front that groups posts by topic. Tidy yours with the [hashtag cleaner](/tools/hashtag-cleaner) |

## Measuring

| Term | Meaning |
|---|---|
| Views | How many times your content was shown |
| Reach | How many different people saw your content |
| Engagement | Reactions, comments, shares, and other actions on a post |
| Engagement rate | Engagement divided by followers or by reach, as a percentage. Try the [engagement rate calculator](/tools/engagement-rate-calculator) |
| Follower growth | The change in your follower count over a period. See the [follower growth calculator](/tools/follower-growth-calculator) |
| UTM tag | A label added to a link so your website analytics can show where visitors came from. Build one with the [UTM link builder](/tools/utm-link-builder) |
| Insights | Facebook's own performance numbers for a Page |

## Rules and safety

| Term | Meaning |
|---|---|
| Page | A Facebook profile for a business or organization, different from a personal profile |
| Permission | Something you allow an app to do with your Page, such as publish posts |
| Access token | A secret key that lets an app act for your Page. LazyAI stores it encrypted |
| Giveaway | A promotion where entrants can win a prize. Read [Facebook giveaway rules](/blog/facebook-giveaway-rules-for-small-businesses) first |`,
  },
];

export const DOC_SLUGS = DOCS.map((d) => d.slug);
export const getDoc = (slug: string): DocPage | undefined => DOCS.find((d) => d.slug === slug);
