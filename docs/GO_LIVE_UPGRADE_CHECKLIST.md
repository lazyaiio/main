# Move from free tiers to paid: checklist

You decided to stay on Vercel Hobby and free tiers while building, and to upgrade before commercial launch. Use this list when you are ready. Nothing here is done for you. **STOP AND CONFIRM** before any paid step.

## Why upgrade

| Service | Free tier limit that matters | Upgrade when |
|---|---|---|
| Vercel Hobby | Not allowed for commercial use by Vercel's terms; shorter function limits; fewer team features | Before you take payment from anyone |
| Supabase Free | Projects pause after a week of inactivity; no reliable backups | Before real customer data, and before the cron job must never miss a run |
| Resend Free | Low daily and monthly sending caps; one domain | When you expect more than the free quota of emails |
| AI providers | Free models are rate-limited and change | When quality or volume needs a paid model (use the switches in Admin -> AI providers; set spending limits in each provider's dashboard) |
| Meta | Free, but the app must pass App Review for posting to other people's Pages | Before inviting outside customers (Batch 13) |

## Steps, in this order

1. **Decide** the launch date and the monthly budget you accept.
2. **Create a separate Production Supabase project** (paid plan), run all migrations `0001` to `0013` in order, then make yourself a platform admin (see `docs/SUPABASE_SETUP.md`).
3. **Upgrade Vercel** to Pro. Move Production environment variables to the new Supabase project. Keep Preview on the old (free) project so tests never touch real data.
4. **Set provider spending limits** in each AI provider's dashboard before adding paid keys.
5. **Resend:** upgrade if needed and verify your domain (runbook section 5).
6. **Domain** (runbook sections 3 and 4).
7. **Smoke test** (runbook section 6) and a trial sign-up with a fresh email.
8. **Turn on live posting only after your explicit decision** (Admin -> Publishing).
9. Write down the monthly costs so Batch 13's cost review has real numbers.
