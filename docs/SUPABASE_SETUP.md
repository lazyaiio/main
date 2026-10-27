# Supabase setup (Batch 2) — free plan, dev project

Do these once. Dashboard labels can change slightly; the idea stays the same.

## 1. Create the project
supabase.com → **New project** (free plan). Choose a region close to your users and save the database password somewhere safe (not in GitHub).

## 2. Create the tables (run the migration)
1. Open **SQL Editor → New query**.
2. Open `supabase/migrations/0001_profiles_workspaces.sql` from the repo, copy everything, paste, **Run**.
3. Run it **only once**. If you run it again it will fail with "already exists" — that is safe, nothing is overwritten.

## 3. Run the isolation test
1. New query → paste all of `supabase/tests/rls_tenant_isolation.sql` → **Run**.
2. Expected result: `ALL RLS TESTS PASSED`. Anything starting with `FAIL` means a security rule is wrong: send me the message.
3. The test makes its own throwaway users and rolls back; nothing stays in your database.

## 4. Tell Supabase your site address
**Authentication → URL Configuration**
- **Site URL:** your Vercel address, e.g. `https://lazyai-xxxx.vercel.app`
- **Redirect URLs** (add both): `https://lazyai-xxxx.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`

Keep **Email** sign-in enabled and **Confirm email** switched on.

## 5. Give the site its keys
Project **Settings → API** (or "API Keys"):
- **Project URL** → Vercel variable `NEXT_PUBLIC_SUPABASE_URL`
- **anon / publishable key** → Vercel variable `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the public one; either the legacy "anon" key or the newer "publishable" key)

In Vercel: Project → **Settings → Environment Variables** → add both → then **Deployments → Redeploy**.
Also add `NEXT_PUBLIC_APP_URL` with your Vercel address.

## 6. Never paste these anywhere
- The **service_role / secret** key and the **database password**. They are not needed yet. When a later batch needs the service key it goes only into Vercel's environment variables, never into GitHub or chat.

## Good to know (free plan)
- Supabase's built-in auth email is for testing only and sends very few emails per hour. Batch 10 connects Resend so confirmation and reset emails are reliable.
- Free projects can pause after a period of inactivity; unpause from the dashboard.
- Without the two public variables the site still works, but sign-in pages show "not set up yet" and `/app` stays locked.

---

## Batch 3 additions: migration 0002 (run once, after 0001)

1. SQL Editor → New query → paste all of `supabase/migrations/0002_core_data_model.sql` → **Run**. Run it **once**; a second run fails with "already exists", which is safe.
2. New query → paste all of `supabase/tests/rls_core_tables.sql` → **Run**. Expected: `ALL CORE RLS TESTS PASSED`. If you see a message starting with `FAIL`, send it to me word for word.
3. No new Vercel variables are needed for Batch 3.


---

## Batch 4 additions: migration 0003, admin access, AI keys

### 1. Run the migration and its test
1. SQL Editor -> new query -> paste all of `supabase/migrations/0003_admin_and_ai.sql` -> **Run** (once).
2. New query -> paste all of `supabase/tests/rls_admin_ai.sql` -> **Run**. Expected: `ALL ADMIN/AI TESTS PASSED`. If you see `FAIL`, send the exact message.

### 2. Make yourself a platform admin
Admins are added with SQL only (the website cannot do it, on purpose). Sign up on the site first, then run this once, replacing the email with the one you signed up with:

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'YOUR_EMAIL_HERE';
```

Then reload the site: an **Admin** link appears in the sidebar, and `/admin/ai-providers` opens. Anyone who is not an admin sees a normal "not found" page there.

### 3. Add AI keys (Vercel environment variables)
Vercel -> your project -> **Settings -> Environment Variables**. Add only the providers you want:

| Variable | Provider |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic (Claude) |
| `OPENAI_API_KEY` | OpenAI |
| `GEMINI_API_KEY` | Google Gemini |
| `OPENROUTER_API_KEY` | OpenRouter (has some free models; names end in `:free`) |

Then **Deployments -> Redeploy**. Never paste a key into chat or GitHub.

### 4. Turn providers on
Admin -> AI providers. Each card shows "Key found" once the variable is detected. Tick **Active**, check the model name, set a priority (lowest number is tried first), **Save**, then **Test connection** (sends about 20 tokens). Model names change often; if the test says the model name may be wrong, look up the provider's current model list and update the field.

### 5. Optional variables
- `AI_MAX_GENERATIONS_PER_HOUR` (default 30 per user) limits runaway cost.
- `AI_MOCK=1` makes the app use built-in sample text when no real provider is active, so you can try the flow for free. It is ignored on the production environment.


---

## Batch 5 additions: migration 0004 (reading articles from links)

1. SQL Editor -> new query -> paste all of `supabase/migrations/0004_source_documents.sql` -> **Run** (once).
2. New query -> paste all of `supabase/tests/rls_sources.sql` -> **Run**. Expected: `ALL SOURCE TESTS PASSED`. If you see `FAIL`, send the exact message.
3. No new environment variables are required. Optional: `URL_EXTRACTIONS_PER_HOUR` (default 20 per user) and `URL_EXTRACTIONS_PER_HOST_PER_HOUR` (default 5 per website).
4. Try it: New post -> paste an article link (for example a public blog post) -> Generate. The post ends with `Source: <link>` and the editor shows "Based on ...". Pages that need a login, sit behind a paywall, or ask not to be read by robots.txt show a clear message.


---

## Batch 6 additions: migration 0005 (campaign planner)

1. SQL Editor -> new query -> paste all of `supabase/migrations/0005_campaign_planner.sql` -> **Run** (once). It adds the `campaign_slots` table, a `brief` column on `campaigns`, and the functions that start, pause, cancel, and resume campaigns. It also stops browsers from changing a campaign's `status` directly.
2. New query -> paste all of `supabase/tests/rls_campaign_planner.sql` -> **Run**. Expected: `ALL CAMPAIGN PLANNER TESTS PASSED`. If you see `FAIL`, send the exact message (it names the failing check, for example `FAIL A7`).
3. No new environment variables are required. Reminder: `AI_MAX_GENERATIONS_PER_HOUR` (default 30 per user) also limits campaigns. A 90-post campaign therefore pauses once the hourly limit is reached; press **Resume writing** later. Raise the limit only if you accept the AI cost.
4. Try it: Campaigns -> New campaign -> fill the form -> **Preview calendar** -> **Create campaign** -> **Start writing**. Keep the page open while posts are written. Test mode (`AI_MOCK=1`) works for a free dry run.


---

## Batch 7 additions: migration 0006 (media library)

1. SQL Editor -> new query -> paste all of `supabase/migrations/0006_media.sql` -> **Run** (once). It creates the private `media` storage bucket, the storage rules, and the function that registers uploads.
2. New query -> paste all of `supabase/tests/rls_media.sql` -> **Run**. Expected: a result row `ALL MEDIA TESTS PASSED`. If you see `FAIL`, send the exact message (for example `FAIL A7`).
3. (Optional) Stock photos: see `docs/MEDIA_PROVIDERS.md`. In Vercel add `IMAGE_PROVIDER=pexels` and `IMAGE_PROVIDER_API_KEY=<your free Pexels key>`, then redeploy. Without them, uploading your own images still works.
4. Try it: Media -> upload a small JPG or PNG -> add alt text. Then open a post -> **Add an image** -> **Use this image**.


---

## Batch 8 additions: thumbnails (migration 0007) and Facebook connections (migration 0008)

Run these **before** or right after uploading the Batch 8 files (the Media page needs 0007):

1. SQL Editor -> paste `supabase/migrations/0007_media_thumbnails.sql` -> **Run**. Then paste `supabase/tests/rls_media_thumbnails.sql` -> **Run**. Expected result row: `ALL THUMBNAIL TESTS PASSED`.
2. SQL Editor -> paste `supabase/migrations/0008_facebook_connections.sql` -> **Run**. Then paste `supabase/tests/rls_social.sql` -> **Run**. Expected result row: `ALL SOCIAL TESTS PASSED`.
3. In Media, older images show a bar "N older images have no small preview yet": press **Create thumbnails** (a few at a time) until it disappears.
4. Facebook: follow `docs/META_SETUP.md` (new Vercel variables: `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID`, `TOKEN_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).


---

## Batch 9 additions: legal pages, data deletion callback (0009), scheduling (0010)

1. SQL Editor -> `supabase/migrations/0009_data_deletion.sql` -> **Run**, then `supabase/tests/rls_data_deletion.sql` -> **Run**. Expected result row: `ALL DATA DELETION TESTS PASSED`.
2. SQL Editor -> `supabase/migrations/0010_scheduling.sql` -> **Run**, then `supabase/tests/rls_scheduling.sql` -> **Run**. Expected result row: `ALL SCHEDULING TESTS PASSED`.
3. Vercel variables (then redeploy): `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_OPERATOR_COUNTRY` (legal pages), `CRON_SECRET` (scheduler). Keep `LIVE_PUBLISHING_ENABLED` unset until you approve real posting.
4. Scheduler: follow `docs/SCHEDULER_SETUP.md`. Meta submission: `docs/META_APP_REVIEW.md`.


---

## Batch 9 fix: publishing switch and diagnostics (migration 0011)

1. SQL Editor -> `supabase/migrations/0011_platform_settings.sql` -> **Run**, then `supabase/tests/rls_platform_settings.sql` -> **Run**. Expected result row: `ALL PLATFORM SETTINGS TESTS PASSED`.
2. Open **Admin -> Publishing** in the app. The live publishing switch is there (not in Vercel). The page shows whether the scheduler is running.


---

## Batch 10 additions: email (migration 0012)

1. SQL Editor -> `supabase/migrations/0012_email.sql` -> **Run**, then `supabase/tests/rls_email.sql` -> **Run**. Expected result row: `ALL EMAIL TESTS PASSED`.
2. Follow `docs/EMAIL_SETUP.md` (Resend account, domain, API key, three Vercel settings, webhook, Supabase SMTP). Without it the app works; notifications are skipped.
3. Open **Admin -> Email** to check the setup and send a test email. People choose which emails they get under **Settings -> Email notifications**.


---

## Batch 11 additions: plans, limits, rate limits (migration 0013)

1. SQL Editor -> `supabase/migrations/0013_plans_and_limits.sql` -> **Run**. Then run `supabase/tests/rls_plans_limits.sql` (expected result row: `ALL PLANS AND LIMITS TESTS PASSED`) and `supabase/tests/rls_account_deletion.sql` (expected: `ALL ACCOUNT DELETION TESTS PASSED`).
   Existing workspaces start on the **Free** plan (100 AI posts a month, 500 posts, 3 Pages, 100 images, 200 MB, 10 open campaigns). If your own workspace is already above a limit, nothing is deleted; you just cannot add more until you are below it. To give yourself more room, use **Admin -> Plans** (switch your workspace to Standard).
2. Open **Settings**: new sections **Plan and usage**, **Your data** (download), and **Delete my account**. Admin -> **Plans** lists plans and changes a workspace's plan.
3. GitHub: turn on Dependabot alerts and secret scanning (Settings -> Code security). See `docs/SECURITY.md`.
