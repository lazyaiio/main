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
