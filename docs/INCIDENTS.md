# Incident notes: what to do when something breaks

Stay calm. Most problems are one switch or one setting. Do the first step, then read down for your situation. Write down the time, what you saw, and what you did.

## First minute, for anything involving posting
1. **Admin -> Publishing -> turn live publishing OFF.** Scheduled posts then wait instead of going out.
2. Nothing is lost by waiting: posts stay scheduled, and late ones can be retried by hand.

## Situations

**A wrong or embarrassing post went live**
1. Turn live publishing OFF (above).
2. Delete the post on Facebook (it is your Page). LazyAI cannot delete it for you.
3. In LazyAI, cancel any other scheduled posts from the same campaign until you have checked them.
4. Find out why (a post was approved by mistake, a wrong Page was chosen), then turn publishing back ON.

**Posts are not going out**
1. Admin -> Publishing: read the checks. Common causes: live publishing is OFF, the scheduler heartbeat is old, `CRON_SECRET` differs between Vercel and the Supabase cron job.
2. `docs/SCHEDULER_SETUP.md` has a table of reasons shown by the scheduler and the fix for each.
3. Press "Publish due posts now" in Admin -> Publishing to test one run.

**Facebook says a Page needs reconnecting, or lots of posts failed at once**
Facebook may have changed permissions or had an outage. Check Facebook's platform status, wait, then use Retry on the failed posts. Reconnect the Page if the message says so.

**A secret key was exposed (pasted in chat, committed to GitHub, or leaked)**
1. Turn live publishing OFF.
2. Rotate it: create a new key in that service, put it in Vercel, redeploy, then delete the old key. The table in `docs/SECURITY.md` lists each key.
3. `TOKEN_ENCRYPTION_KEY` cannot be rotated without reconnecting every Page (saved Page access is encrypted with it). Ask for help before changing it.
4. If customer data may be affected, tell them, as the Privacy Policy promises.

**The site is down or shows an error after a deploy**
Use Vercel -> Deployments -> the last good Production deployment -> Promote to Production (`docs/DEPLOYMENT_RUNBOOK.md` section 7). Then fix the code before the next upload.

**Sign-in or emails stopped working**
Check Supabase's status page and that the project is not paused. Check Admin -> Email and Resend's dashboard for bounces and limits. Check that `NEXT_PUBLIC_APP_URL` and the Supabase redirect URLs still match your domain (Admin -> Deployment).

**A customer asks to delete their data**
They can delete their account in Settings, or use the Data deletion page. Requests from Facebook arrive on their own. Answer within the number of days stated in the Privacy Policy.

**The AI bill is rising fast**
Set or lower the spending limit in the provider's dashboard, then lower plan limits in Admin -> Plans.

## After any incident
Add a short note to `docs/BUILD_PROGRESS.md`: what happened, the cause, the fix, and what would prevent it next time.
