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
