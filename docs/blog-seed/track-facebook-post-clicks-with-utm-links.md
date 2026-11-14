---
title: How to Track Facebook Post Clicks with UTM Links
seoTitle: How to Track Facebook Post Clicks with UTM Links
metaDescription: Learn how to track Facebook post clicks with UTM links: what the tags mean, how to name campaigns, and how to see which posts bring visitors to your site.
excerpt: Facebook tells you how many people clicked. Your website tells you what they did next. UTM links connect the two, and they take about a minute to add.
category: scheduling-and-ai
tags: utm links, analytics, link tracking, campaigns
isPillar: false
focusKeyword: track facebook post clicks
featuredQuery: marketer analyzing website visitors on a laptop
---

You post a link to your shop, your menu, or your latest article. People click. But which post sent them, and did they buy anything? If you want to track Facebook post clicks all the way to your website, you need a small tag at the end of the link. It is called a UTM tag, and this guide shows how to use it without any technical background.

You do not need special software to add the tags. You need a web address, three short labels, and a habit of using the same names every time.

[[image: marketer analyzing website visitors on a laptop | Looking at website visitor numbers on a laptop]]

## The problem UTM links solve

Facebook can tell you how many people clicked a link in a post. Your website analytics can tell you how many people visited and what they did. The trouble is that the two do not always connect clearly. A visit can show up as "referral" or "social" without telling you which post or campaign caused it.

A UTM tag fixes that. It adds labels to your link. When someone clicks it and lands on your site, your analytics tool reads the labels and files the visit under the right campaign.

## What a UTM link looks like

Here is a plain link:

https://example.com/spring-sale

Here is the same link with tags:

https://example.com/spring-sale?utm_source=facebook&utm_medium=social&utm_campaign=spring-sale

The page is the same. The part after the question mark is the tag. Visitors do not need to care about it. Your analytics tool reads it.

## The five tags

- **utm_source** says where the click came from. For Facebook, use facebook.
- **utm_medium** says what kind of link it is. For social posts, use social.
- **utm_campaign** names the campaign or promotion, such as spring-sale.
- **utm_term** is optional. It was made for paid search keywords, and most Page owners skip it.
- **utm_content** is optional. Use it to tell two links in the same campaign apart, such as post-1 and post-2.

Start with source, medium, and campaign. Add content when you want to compare two posts.

## Step by step: tag a link

1. **Copy the web address** that your post will link to.
2. **Open a link builder.** Our free [UTM link builder](/tools/utm-link-builder) does the formatting for you and cleans the values.
3. **Fill in source, medium, and campaign.** Use facebook, social, and a short campaign name.
4. **Add content** if you are testing two versions.
5. **Copy the finished link** and paste it into your post.
6. **Click it once yourself** to make sure it still opens the right page.

When you schedule the post, paste the tagged link into the post text. If you are not sure how scheduling works, our guide to [scheduling Facebook Page posts](/blog/how-to-schedule-facebook-page-posts) walks through the options.

## Name things the same way every time

Consistency is the whole secret. Analytics tools treat "Spring-Sale" and "spring-sale" as two different campaigns. Then your report splits one campaign into two lines, and you waste time adding them together.

Follow a few simple rules.

- **Use lowercase only.** It removes a common source of duplicates.
- **Use hyphens instead of spaces.** For example, black-friday-2026.
- **Keep names short and clear.** You should understand them in six months.
- **Reuse the same source and medium.** Always facebook and social for your Page posts.
- **Never include personal information.** Anyone who sees the link can read the tags.

Keep a small spreadsheet with the campaign names you use. A new campaign takes five seconds when you copy the last one.

[[image: spreadsheet of campaign names on a laptop screen | A simple list of campaign names]]

## Where to see the results

The results appear in your website analytics, not in Facebook. Tools such as Google Analytics read UTM tags and group visits by source, medium, and campaign. Look for a report about traffic or acquisition, and filter by your campaign name. The exact menus change from time to time, so check your tool's help pages if you cannot find it.

You will usually see how many visits each campaign sent and what those visitors did. If your site records purchases or sign-ups, you can see which campaign led to them. That is the number that tells you whether a post was worth the effort.

## Compare it with what Facebook shows

Facebook's own numbers are still useful. They show how many people saw and reacted to a post. Your analytics show what happened after the click. Put them side by side.

- A post with many reactions but few site visits was liked, but it did not make people act.
- A post with few reactions but many visits may have a strong link or offer.
- A post with high reach but no visits may need a clearer call to action.

Our guide to [Facebook Page metrics](/blog/facebook-page-metrics-explained) explains the Facebook side of this picture.

[[image: garden shop owner arranging spring plants | A garden shop preparing a spring sale]]

## A worked example

Imagine a garden shop that runs a spring sale. The shop posts three times in a week and each post links to the sale page. It tags the three links like this.

- Monday, a photo post: utm_campaign=spring-sale and utm_content=photo-post
- Wednesday, a short video: utm_campaign=spring-sale and utm_content=video
- Friday, a text offer: utm_campaign=spring-sale and utm_content=text-offer

Source is facebook and medium is social on all three. A week later the shop opens its analytics and filters by the campaign name. It sees the visits from each version and the orders that followed. Perhaps the video sent the most visitors, but the text offer led to the most orders. That tells the shop to keep making videos for attention and to use plain offers for the final push.

Without the tags, all three posts would have looked like one lump of social traffic. The shop would have guessed instead of knowing.

## Tagging when more than one person posts

If a team shares the work, agree on the rules before the first link. Put the naming rules and the list of campaign names in a shared document. Choose one person to approve new campaign names. Ask everyone to use the same link builder.

This small step prevents the usual mess. Without it, one person writes "spring_sale" and another writes "Spring Sale", and the report splits into three lines. A shared list takes ten minutes to make and saves hours later.

## Mistakes to avoid

- **Tagging links inside your own website.** UTM tags are for links that bring people to your site. On your own pages they can overwrite where the visit really came from.
- **Changing names halfway through a campaign.** Your report will split into pieces.
- **Using capital letters and spaces.** They create duplicates and broken links.
- **Forgetting to test.** Click the link before you publish.
- **Hiding tags behind link shorteners without testing.** Make sure the short link still carries the tags to your page.
- **Expecting perfect numbers.** Some visitors block tracking or use more than one device, so counts are an estimate.

[[image: team reviewing a campaign report together | A small team reviewing a campaign report]]

## Frequently asked questions

**Do UTM tags change what people see?** The page looks the same. The tags only add information to the address.

**Do I need to tag every link?** Tag links that matter, such as offers, sign-ups, and product pages. A link you only mention in passing may not need it.

**Can I tag links in comments?** Yes. Any link that brings people to your site can carry tags.

**Will tags hurt my reach?** We cannot promise how Facebook shows any post. The tags do not change your page, and you can compare your own results to check.

**What if I already use another tracking method?** You can keep it. Just avoid mixing two systems for the same campaign.

## Your next step

Pick one post you plan to publish this week with a link in it. Build a tagged link with the [UTM builder](/tools/utm-link-builder), publish it, and check your analytics a few days later. Write down what you learn, and tag the next link the same way.
