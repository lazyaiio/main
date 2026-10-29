# Stock photo providers (Batch 7 review)

The master plan says to add a stock provider only after reviewing API access and licensing. This is that review.
It was written from the provider's public pages found while building Batch 7. It is **not legal advice**:
read the linked pages yourself before you turn the feature on for customers.

## Chosen first provider: Pexels

- **Access:** free API key from https://www.pexels.com/api/ (needs a free Pexels account).
- **Cost:** free. The default limit is about 200 requests per hour and 20,000 per month for the whole key (shared by all your users). Pexels says higher limits can be requested. LazyAI therefore limits each user to 20 searches and 10 imports per hour (`src/lib/media/limits.ts`) and shows a friendly message when Pexels answers "busy".
- **Credit:** Pexels asks API users to show a visible link to Pexels and, when possible, to credit the photographer. LazyAI shows "Photos provided by Pexels" next to every search and "Photo by <name> on Pexels" under every result, and stores the credit text, photographer link, photo page, and license on the library entry.
- **License:** https://www.pexels.com/license/. In short, photos are free for commercial use and attribution is not required. Not allowed (as we read it): selling unaltered copies, implying that the people shown endorse a product, using a photo in a trademark or logo, or showing identifiable people in a bad light. Do not use stock photos of people to suggest a specific real customer or testimonial.
- **Storing a copy:** LazyAI downloads the chosen photo once and keeps it in your private storage bucket, so it can be posted later without depending on Pexels. The server looks the photo up by id again and downloads only from `images.pexels.com`.

## Why Pexels first
Other free sources have rules that fit this design less well (this part comes from memory and was not re-checked, so verify before adding one): Unsplash asks API apps to link back to the original image address and to report downloads; Pixabay asks apps not to hotlink and to store images themselves. Both are possible later through the same `ImageSearchProvider` interface in `src/lib/media/image-search.ts`.

## How to turn it on
1. Create a free Pexels account and request an API key.
2. In Vercel -> Settings -> Environment Variables add `IMAGE_PROVIDER` = `pexels` and `IMAGE_PROVIDER_API_KEY` = your key (never in GitHub or chat). Redeploy.
3. Open Media: the "Find a free stock photo" box now searches.

## Before a commercial launch
- Re-read the Pexels API guidelines and license.
- Decide whether to request a higher API limit.
- Consider adding a second provider as a fallback.


## Batch 14 update: Pexels and Pixabay, set up in the admin page
- **Admin -> Stock photos** lets a platform admin paste a Pexels and/or Pixabay key. Keys are encrypted with `TOKEN_ENCRYPTION_KEY` before they are stored and are never shown again. Environment variables (`PEXELS_API_KEY`, `PIXABAY_API_KEY`, or the older `IMAGE_PROVIDER` + `IMAGE_PROVIDER_API_KEY`) still work as a fallback.
- If both are on, Pexels is searched first and Pixabay is used when Pexels has no match or fails.
- **Pixabay:** free key from https://pixabay.com/api/docs/ (about 100 requests per minute). Photos are under the Pixabay Content License (verify the current terms yourself). Pixabay asks apps not to hotlink, so LazyAI always stores its own copy, and it shows a credit link.
- **Automatic photos in campaigns:** when a campaign has "Add a free stock photo to each post" on, each finished post gets one photo found from its image idea. The same photo is never used twice in a workspace. At most 40 automatic searches per workspace per hour.


## Batch 14.1: Unsplash added, providers run side by side, Pexels optional
- Providers: **Pixabay** and **Unsplash** are the active pair. **Pexels** stays available but optional: leave it empty now and paste a key in Admin, Stock photos when Pexels gives keys out again.
- Every provider that is on is searched **at the same time** and the results are mixed (one from each in turn). A provider that fails or hits its limit is skipped.
- **Unsplash:** free Access Key from https://unsplash.com/developers. A new app is in "demo" mode with **50 requests per hour**; apply for production in the Unsplash dashboard for more. Each automatic photo costs about 2 Unsplash requests (search and a "download" report that Unsplash requires). Credit text and links to the photographer and Unsplash are saved with every photo.
- **Please check Unsplash's current API guidelines yourself.** They ask apps to show photos from their own image links. LazyAI keeps its own copy of each photo, because Facebook needs the file. Unsplash's license allows downloading, but confirm the API terms suit this use before launch.
