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
