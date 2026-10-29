# Scheduler setup (publishing scheduled posts)

LazyAI publishes scheduled posts when a protected address, `/api/cron/dispatch`, is called. Something has to call it **every minute**. Vercel's free (Hobby) cron can only run once a day, so use Supabase's built-in scheduler (free) for the every-minute call. The once-a-day Vercel cron in `vercel.json` stays as a safety net.

## What protects it
- The address answers only requests that carry your secret: `Authorization: Bearer <CRON_SECRET>`. Without the secret, or when no secret is set, it answers 401 and does nothing.
- Real Facebook posting is **off** until a platform admin switches it on in the app: **Admin -> Publishing -> Switch live publishing ON**. Until then, scheduled posts simply wait (nothing is claimed or sent).
- Only **approved** posts on **connected** Pages are published. A post that is edited after scheduling must be approved again.
- A post that was being published when something broke is never retried automatically (it might already be on Facebook). You see "We could not confirm whether this post reached Facebook" and choose: "It is on my Page" or "post it again".
- A post more than 6 hours late is not published silently; you choose Retry.

## Steps
1. **Make a secret.** Use your password manager to create 24 or more random letters and digits.
2. **Vercel -> Settings -> Environment Variables:** add `CRON_SECRET` = that secret. **Redeploy.**
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
`status_code` 200 and content like `{"ok":true,"disabled":true,...}` means it works and publishing is still switched off (as intended). `401` means the secret does not match: see "If the check shows 401" below.

To stop it: `select cron.unschedule('lazyai-dispatch');`

## If the check shows 401 ("unauthorized")
The address answered, but refused the secret. The answer now includes a reason:
```sql
select status_code, content from net._http_response order by created desc limit 3;
```
| `content` shows | Meaning | Fix |
|---|---|---|
| `"reason":"not_configured"` | The website has no usable `CRON_SECRET`: it is missing, shorter than 16 characters, set only for Preview instead of **Production**, or you did not redeploy after adding it. | Vercel -> Settings -> Environment Variables: add `CRON_SECRET` (Production, 24+ letters and digits), then **Deployments -> Redeploy**. |
| `"reason":"invalid"` | The secret in the Supabase cron job is different from `CRON_SECRET` in Vercel. Common causes: the placeholder `YOUR_CRON_SECRET` was left in the SQL, a typo, quotes or spaces pasted around the value in Vercel, or the secret was changed in Vercel later. | Use a secret with only letters and digits (no quotes, spaces, or symbols). Put the **same** value in both places, then redo the cron job as below. |
| `"reason":"missing"` | The request had no `Authorization: Bearer ...` header (the SQL was edited incorrectly). | Redo the cron job exactly as in step 4. |
| (an HTML page, not JSON) | Vercel's own protection (Deployment Protection) is blocking the call, or the address is wrong. | Vercel -> Settings -> Deployment Protection: make sure Production is not behind login, and use your production domain. |

**Redo the cron job with the new secret** (SQL Editor; replace both placeholders):
```sql
select cron.unschedule('lazyai-dispatch');

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
Wait two minutes and run the check again. `status_code` 200 means it works. You can also open **Admin -> Publishing**: "Scheduler is calling this site" turns green after the first successful call.

## Where to see what is happening: Admin -> Publishing
Open **Admin -> Publishing** (you must be a platform admin). It shows, with green/yellow/red marks:
1. whether the Facebook settings are complete,
2. whether `CRON_SECRET` is set,
3. **whether the scheduler has called the site** and when it last ran (if it says "never", the Supabase cron job is not set up or the secret does not match),
4. whether the **live publishing switch** is ON,
and the queue (due now, waiting, failed, published in the last 24 hours). The button **Publish due posts now** runs the publisher once by hand, which is also a good way to test without the scheduler.

## Turning live publishing on (after your approval)
1. Connect a **test Page** and schedule one approved post a few minutes ahead. It will wait ("Live publishing is switched off").
2. When you are ready for real posting: **Admin -> Publishing -> tick the box -> Switch live publishing ON**. No redeploy is needed. The next scheduler run (within a minute) publishes due posts.
3. Check the post on the Page and in LazyAI (status "Published").
To stop real posting at any time: **Admin -> Publishing -> Switch live publishing OFF**. (Emergency stop from the hosting settings: `LIVE_PUBLISHING_ENABLED=0` and redeploy.)

## Time zones in one minute
The server runs on UTC. LazyAI saves each schedule as an exact moment and converts using the **workspace time zone** shown in Settings (default Asia/Dhaka). The time you type is read as workspace time, whatever the server or your computer uses. The schedule box shows the current time in the workspace time zone and what your choice means on your computer.

## Other ways to call it
Any service that can send an HTTP request every minute with the header works (for example cron-job.org): address `https://YOUR-DOMAIN/api/cron/dispatch`, method GET or POST, header `Authorization: Bearer <CRON_SECRET>`.


## Batch 14: the same scheduler now also writes campaigns
The every-minute call to `/api/cron/dispatch` now does two things: it publishes due posts, and then it writes the next few posts of every campaign that is "generating" (with the time that is left of the 60 seconds). This is what lets a campaign keep going after the browser is closed. Nothing new has to be set up. If **Admin -> Publishing** shows the scheduler as running, background writing works. If the scheduler is not running, campaigns are written only while their page is open.
