# Known limitations (as of Batch 13)

Plain list of what LazyAI does not do, or does only partly. Share the customer-relevant parts honestly.

## Product
- **Facebook Pages only.** Personal profiles, Instagram, and other networks are not supported.
- **Text and one image per post.** No video, carousels, polls, or link-preview control.
- **Languages:** posts can be written in English or Bengali. The website and dashboard are English only. AI output can be wrong or awkward, especially in Bengali, so every post must be reviewed.
- **No analytics yet.** LazyAI does not show likes, reach, or comments. The Facebook permission for reading engagement is requested for connection checks only.
- **One workspace per person.** The database is ready for teams, but there is no screen for inviting members.
- **No payments.** Plans and limits exist, and the Admin can change a workspace's plan, but there is no checkout or invoicing.
- **Pages behind logins, paywalls, or that block robots cannot be read** when creating a post from an article link.

## Publishing
- **Real posting is off until the Admin switches it on**, and needs the scheduler to be running every minute.
- **Uncertain results are never retried automatically.** If the connection fails at the exact moment of sending, a person checks the Page and decides (to avoid double posts).
- **Posts more than 6 hours late are not published automatically** (for example after an outage). A person retries or reschedules.
- **Facebook rules apply.** Facebook can limit requests, change permissions, or reject content. LazyAI shows a plain message and retries only where it is safe.

## Provider approvals
- **Meta App Review** must be approved (and the app set to Live) before customers without a role on your Meta app can connect Pages. Timing and outcome are Meta's decision. See `docs/META_APP_REVIEW.md`.
- **Email** needs a verified domain for good delivery. Free tiers have low sending caps.
- **AI and stock photo providers** change prices, models, and limits. Free tiers are rate-limited.

## Platform
- **Free tiers while building.** Supabase Free pauses idle projects and has no reliable backups. Vercel Hobby is not for commercial use. See `docs/GO_LIVE_UPGRADE_CHECKLIST.md`.
- **Major package upgrades are postponed** (Tailwind 4, TypeScript 7, Zod 4). Dependabot does not propose them. Plan them as their own batch after launch.
- **Not tested by a person on real devices:** screen readers and every phone model. The automated checks cover images, labels, landmarks, text contrast, and zoom.
- **Legal pages** are starting texts and need a lawyer's review before launch.
