# Submitting the Meta app (checklist and draft answers)

Use this together with `docs/META_SETUP.md`. Replace `YOUR-DOMAIN` with your real site address (the same one in Vercel). Meta's forms change; the field names may differ slightly.

## 1. App settings -> Basic
| Field | Value |
|---|---|
| Privacy Policy URL | `https://YOUR-DOMAIN/privacy` |
| Terms of Service URL | `https://YOUR-DOMAIN/terms` |
| User data deletion | **Data deletion request URL:** `https://YOUR-DOMAIN/api/meta/data-deletion` (or, instead, **Data deletion instructions URL:** `https://YOUR-DOMAIN/data-deletion`) |
| Deauthorize callback URL (Facebook Login settings) | `https://YOUR-DOMAIN/api/meta/deauthorize` |
| App domains | `YOUR-DOMAIN` |
| Contact email | the address you set as `NEXT_PUBLIC_CONTACT_EMAIL` (it is shown on `/contact`) |
| App icon | 1024 x 1024 PNG (the LazyAI logo mark) |
| Category | Business and pages |

Before this works, add in Vercel and redeploy: `NEXT_PUBLIC_CONTACT_EMAIL` (your real support email), `NEXT_PUBLIC_OPERATOR_NAME` (your legal or business name), `NEXT_PUBLIC_OPERATOR_COUNTRY` (country whose law governs the Terms). Open `/privacy`, `/terms`, `/contact`, and `/data-deletion` in a private browser window (not signed in) and confirm they load and show your email.

The deletion and deauthorize addresses are POST endpoints that check Meta's signature with your app secret, so opening them in a browser shows an error. That is expected.

## 2. Business verification
Meta Business Settings -> Security Center -> **Start verification**. You will be asked for your legal business name, address, phone, website, and a document (for example a business registration or utility bill). Review can take days to weeks.

## 3. App Review: permissions to request (Advanced Access)
For each permission Meta asks for a description and a screencast. Draft answers (edit to match what you really do):

- **pages_show_list:** "After the user signs in with Facebook, LazyAI lists the Pages the user manages so they can choose which Pages to connect. We show only the Page names."
- **pages_read_engagement:** "LazyAI reads basic information about the Pages the user manages (name, category, and the user's role) and confirms the connection still works. We do not display or store engagement analytics."
- **pages_manage_posts:** "LazyAI publishes posts to the Page that the user wrote and approved in LazyAI, at the date and time the user scheduled. Nothing is published without the user's approval, and the user can cancel before publishing."
- **business_management (only if Meta lists it as required):** "Needed so users who manage their Pages through a business portfolio can see and connect those Pages."

## 4. What reviewers need
- **A way to log in to LazyAI:** create a separate reviewer account (email and password) in your live site, with a workspace, and put the credentials in the review form. Do not use your own account.
- **A Page they can use:** Meta reviewers test with their own accounts and Pages through the test instructions, or you can add them as testers. Describe the steps: sign in, Facebook Pages, Connect Facebook, choose a Page, create or open an approved post, Schedule, see it published.
- **Screencast (about 2 minutes, with captions):** 1) sign in to LazyAI; 2) Facebook Pages -> Connect Facebook -> the Facebook permission dialog -> choose a Page; 3) open a post, approve it, schedule it for a few minutes ahead; 4) show it published on the Facebook Page; 5) show Disconnect and the Data Deletion page.
- **Publishing:** reviewers' test needs real posting, so switch on live publishing (Admin -> Publishing) and set up the scheduler (`docs/SCHEDULER_SETUP.md`) before you submit.

## 5. Going Live
After approval, switch the app from Development to **Live** (top bar of the app dashboard). Then people without a role on the app can connect their Pages.

## Honest notes
- Review can take several rounds. Typical rejections: a screencast that does not show the permission being used, missing privacy policy details, a login the reviewer cannot use.
- Have a lawyer read the Privacy Policy and Terms before launch. The pages in LazyAI are a solid starting text written for how the product works, but they are not legal advice.
