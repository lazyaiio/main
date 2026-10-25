# Meta (Facebook) app setup, step by step

Why this is needed: Facebook only lets software post to a Page through an **app registered with Meta**. There is no official way around it. (Unofficial automation breaks Meta's rules and can get the Page or your account blocked, so LazyAI does not do that.)

What you get without anything more than this guide: you (and people you add as testers) can connect **your own Pages** in **Development mode**, with no App Review. Connecting other businesses' Pages needs the **Live mode** steps at the end.

Meta changes its dashboard often. If a button has a slightly different name, look for the closest one. Checked against Meta's developer documentation in October 2026 (Graph API v26.0 is current; LazyAI uses v25.0, which stays supported until mid-2028).

## Before you start
- A Facebook account that is an **admin of the Page** you want to use (a role that can create posts).
- Your LazyAI address from Vercel, for example `https://your-project.vercel.app` (Vercel -> your project -> Domains).
- Your redirect address is that address plus `/api/meta/callback`, for example `https://your-project.vercel.app/api/meta/callback`. The Pages screen in LazyAI also shows it once the setup is incomplete.

## Part 1: Create the Meta app
1. Go to https://developers.facebook.com and log in. If asked, register as a developer (it is free).
2. **My Apps -> Create App**.
3. Enter an app name (for example `LazyAI`) and your contact email. Next.
4. **Use cases:** choose **Manage everything on your Page** (this is the Pages API use case). Next.
5. Business portfolio: choose an existing one or skip for now. Next, then **Create app** (Facebook may ask for your password).

## Part 2: Permissions for the use case
1. In the app dashboard open **Use cases -> Manage everything on your Page -> Customize**.
2. Under **Permissions and features**, make sure these are added: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` (also `business_management` and `public_profile`, which are included by default).
3. In Development mode these work for you without review (Meta calls this Standard Access).

## Part 3: Login settings and redirect address
This use case signs people in with **Facebook Login for Business**.
1. In the left menu open **Facebook Login for Business -> Settings** (the name may read "Facebook Login for Business" under Products or Use cases).
2. In **Valid OAuth Redirect URIs** add your redirect address exactly, for example `https://your-project.vercel.app/api/meta/callback`. Turn on **Client OAuth login** and **Web OAuth login** if they are listed. Save.
3. Open **Configurations -> Create configuration**. Name it `LazyAI Pages`. Login variation: **General**. Access token: **User access token**. Permissions: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`. Save.
4. Copy the **Configuration ID** (a long number). You will paste it into Vercel as `META_LOGIN_CONFIG_ID`.
   (If your app uses the older classic Facebook Login instead, you do not need a configuration; leave `META_LOGIN_CONFIG_ID` empty and LazyAI asks for the permissions directly.)

## Part 4: Get the app ID and secret
1. **App settings -> Basic**.
2. Copy **App ID**. Click **Show** next to **App secret** and copy it (Facebook asks for your password). Treat the secret like a password: never put it in GitHub, chat, or screenshots.
3. (Recommended) On the same page, set **App domains** to your Vercel domain (for example `your-project.vercel.app`) and add your contact email.

## Part 5: Add the settings in Vercel
Vercel -> your project -> **Settings -> Environment Variables**. Add these for **Production** (and Preview if you use it):

| Name | Value |
|---|---|
| `META_APP_ID` | the App ID |
| `META_APP_SECRET` | the App secret |
| `META_LOGIN_CONFIG_ID` | the Configuration ID (skip if you use classic Facebook Login) |
| `TOKEN_ENCRYPTION_KEY` | a random string of 32 or more characters (use your password manager's generator, for example 48 random letters and digits). **Keep a safe copy.** If you lose it, Pages must be connected again. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase -> Project Settings -> API -> the **service_role** (secret) key. Server only; never share it. |
| `META_REDIRECT_URI` | optional; only if your address differs from `<your address>/api/meta/callback` |

Then **Deployments -> the latest -> Redeploy** so the settings take effect.

## Part 6: Connect your Page
1. In LazyAI open **Facebook Pages**. The yellow "not set up" box should be gone. (If it lists missing names, add those in Vercel and redeploy.)
2. Click **Connect Facebook**, log in, and allow every permission shown. Choose the Page(s) when Facebook asks.
3. Back in LazyAI, tick the Pages to connect and press **Connect selected Pages**.
4. Press **Check connection** on a Page. It should say "The connection works."

LazyAI does not post anything in this step. Publishing comes in a later batch and needs your separate approval.

## If something fails
| What you see | Likely cause and fix |
|---|---|
| "Can't load URL / redirect_uri isn't whitelisted" on Facebook | The redirect address in Part 3 step 2 differs from the real one (check `https`, spelling, no trailing slash). |
| "App not active" or you cannot log in | The app is in Development mode and your Facebook account has no role on it. App dashboard -> **App roles -> Roles**: add yourself (Admin) or the person as Tester and accept the invitation. |
| LazyAI says permissions were not granted | Try again and keep every permission ticked. Check Part 2 step 2 and that the configuration in Part 3 step 3 lists all three permissions. |
| "No Pages were found" | The Facebook account has no Page role that can post, or you did not select the Page in Facebook's dialog. |
| A Page shows "Needs attention" | Press **Check connection** for the reason; usually **Reconnect** fixes it. |

## Live mode (needed for other businesses' Pages)
A ready-made checklist with draft answers for Meta's forms is in `docs/META_APP_REVIEW.md` (privacy policy, terms, data deletion, and callback addresses are built into LazyAI).

Not needed to test with your own Pages. When you want customers to connect theirs:
1. Complete **App settings -> Basic**: privacy policy URL, terms URL, app icon, category, and data deletion instructions or callback.
2. Complete **Business verification** for your business in Meta Business Settings (documents are reviewed; this can take days to weeks).
3. Request **Advanced Access** for `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts` through **App Review** (you submit a screencast of the login and the feature, and explain why each permission is needed). Meta may also ask you to become a verified Tech Provider because LazyAI connects Pages for other businesses.
4. Switch the app from Development to **Live**.
Expect review to take time and possibly several rounds. Plan it before your commercial launch.

## Disconnecting
In LazyAI, **Disconnect** deletes the saved access for a Page. To also remove the app from your Facebook account: Facebook -> Settings -> **Business Integrations** -> LazyAI -> Remove.
