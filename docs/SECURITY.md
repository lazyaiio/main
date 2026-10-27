# Security, limits, and data handling (Batch 11)

## What protects the product
- **Plan limits are enforced in the database**, not only in the screens. A limit hit by a direct API call is refused the same way as in the app. Limits: AI posts per month, posts, connected Facebook Pages, images, image storage, open campaigns. The numbers live in the `plans` table (`free`, `standard`) and can be overridden for one workspace.
- **Rate limits** on costly actions (image uploads and resizing, thumbnail creation, Facebook checks, data export, account deletion attempts) use a small counter in the database per person and action. AI posts also have an hourly limit and the monthly plan limit.
- **Secrets never reach logs or exports.** Server code logs through `src/lib/log.ts`, which blanks anything named like a secret and anything that looks like a key or token. Audit entries pass through the same redactor. The data export is an allow-list per table. A test scans the whole project for committed keys on every test run.
- **Security headers:** no framing (X-Frame-Options and CSP `frame-ancestors 'none'`), no sniffing, strict HTTPS (HSTS), isolated window (COOP), minimal permissions, `base-uri` and `object-src` locked. A full script-blocking CSP is not enabled yet, because it needs per-request nonces and could break pages; it is a candidate for a later hardening pass.
- **Dependencies:** Dependabot opens weekly update pull requests; a weekly "Security checks" run reports `npm audit` results in its summary (it never blocks a deploy). Turn on **Dependabot alerts** and **Secret scanning with push protection** in GitHub -> Settings -> Code security.

## Give one workspace special limits
Run in the Supabase SQL Editor as a platform admin session is not needed (the editor is the database owner):
```sql
update public.workspaces
set limit_overrides = '{"ai_generations_month": 500, "social_pages": 5}'::jsonb
where id = 'WORKSPACE-ID';
```
Allowed names: `ai_generations_month`, `content_items`, `social_pages`, `media_files`, `media_bytes`, `campaigns_open`. Clear them with `'{}'`. (Admin -> Plans changes a workspace's plan and clears its special limits.)

## Account deletion and data export
- **Download my data** (Settings): a JSON file with the person's workspace content, schedules, activity, usage, and email choices. Never included: passwords, Facebook tokens, image files, storage paths, other people's identities. At most 5 downloads a day.
- **Delete my account** (Settings): needs the password again and the word DELETE. It refuses while a workspace they own still has other members. Then it removes the image files, and deletes the sign-in account; database cascades remove the workspace and everything in it (posts, campaigns, schedules, Facebook connections and stored tokens, usage, activity). Content a person wrote in someone else's workspace stays with the author cleared. Posts already published on Facebook stay on Facebook.
- Verified by `supabase/tests/rls_account_deletion.sql` (no leftovers, other workspaces untouched).

## Keys and rotation (what to do and when)
| Secret | Where | Rotate when | How |
|---|---|---|---|
| Supabase service key | Vercel | leaked, or a person with access leaves | Supabase -> Project Settings -> API: reset the key, update Vercel, redeploy |
| `TOKEN_ENCRYPTION_KEY` | Vercel | leaked | Changing it makes stored Page tokens unreadable: Pages must be connected again (Disconnect, Connect) |
| `META_APP_SECRET` | Vercel | leaked | Meta app -> Basic: reset the secret, update Vercel, redeploy |
| `CRON_SECRET` | Vercel + Supabase cron job | leaked | New value in both places (docs/SCHEDULER_SETUP.md) |
| AI keys, `RESEND_API_KEY`, Pexels key | Vercel | leaked | Create a new key at the provider, update Vercel, redeploy, delete the old key |
Never put these in GitHub, chat, or screenshots. If one was exposed, rotate it first and ask questions later.

## If something goes wrong (incident steps)
1. **Stop real posting:** Admin -> Publishing -> switch live publishing OFF.
2. **Rotate** the exposed secret (table above).
3. **Check activity:** the Activity page (per workspace) and Admin -> Email/Publishing logs show who did what and when.
4. **Tell people** if their data may be affected, as the Privacy Policy promises, and note what happened.
