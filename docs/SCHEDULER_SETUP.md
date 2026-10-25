# Scheduler setup (publishing scheduled posts)

LazyAI publishes scheduled posts when a protected address, `/api/cron/dispatch`, is called. Something has to call it **every minute**. Vercel's free (Hobby) cron can only run once a day, so use Supabase's built-in scheduler (free) for the every-minute call. The once-a-day Vercel cron in `vercel.json` stays as a safety net.

## What protects it
- The address answers only requests that carry your secret: `Authorization: Bearer <CRON_SECRET>`. Without the secret, or when no secret is set, it answers 401 and does nothing.
- Real Facebook posting is **off** until you set `LIVE_PUBLISHING_ENABLED=1`. Until then, scheduled posts simply wait (nothing is claimed or sent).
- Only **approved** posts on **connected** Pages are published. A post that is edited after scheduling must be approved again.
- A post that was being published when something broke is never retried automatically (it might already be on Facebook). You see "We could not confirm whether this post reached Facebook" and choose: "It is on my Page" or "post it again".
- A post more than 6 hours late is not published silently; you choose Retry.

## Steps
1. **Make a secret.** Use your password manager to create 24 or more random letters and digits.
2. **Vercel -> Settings -> Environment Variables:** add `CRON_SECRET` = that secret. (Keep `LIVE_PUBLISHING_ENABLED` unset for now.) **Redeploy.**
3. **Supabase -> Database -> Extensions:** enable **pg_cron** and **pg_net**.
4. **Supabase -> SQL Editor:** run the following after replacing `YOUR-DOMAIN` (for example `your-project.vercel.app`) and `YOUR_CRON_SECRET`:

```sql
select cron.schedule(
  'lazyai-dispatch',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-DOMAIN/api/cron/dispatch',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET', 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
```

5. **Check it works** (wait two minutes):
```sql
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
select status_code, content from net._http_response order by created desc limit 5;
```
`status_code` 200 and content like `{"ok":true,"disabled":true,...}` means it works and publishing is still switched off (as intended). `401` means the secret in the SQL does not match `CRON_SECRET` in Vercel.

To stop it: `select cron.unschedule('lazyai-dispatch');`

## Turning live publishing on (after your approval)
1. In the app, connect a **test Page** and schedule one approved post a few minutes ahead. It will wait ("Live publishing is not switched on yet").
2. When you are ready for real posting: Vercel -> add `LIVE_PUBLISHING_ENABLED` = `1`, redeploy. The next minute, due posts are published.
3. Check the post on the Page and in LazyAI (status "Published").
To stop real posting at any time: remove the variable (or set it to anything else) and redeploy; scheduled posts wait again.

## Other ways to call it
Any service that can send an HTTP request every minute with the header works (for example cron-job.org): address `https://YOUR-DOMAIN/api/cron/dispatch`, method GET or POST, header `Authorization: Bearer <CRON_SECRET>`.
